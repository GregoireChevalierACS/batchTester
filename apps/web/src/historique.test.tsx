/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { FausseApi } from './testing/fausseApi.ts';
import { fauxEcharts } from './testing/fauxEcharts.ts';

async function demarrer(api = new FausseApi()) {
  const utilisateur = userEvent.setup();
  render(<App api={api} delai={0} />);
  await screen.findByRole('article', { name: 'Vainqueur' });
  return { api, utilisateur };
}

async function enregistrer(utilisateur: ReturnType<typeof userEvent.setup>, nom: string) {
  const champ = screen.getByRole('textbox', { name: 'Nom du lancement' });
  await utilisateur.clear(champ);
  if (nom !== '') await utilisateur.type(champ, nom);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Enregistrer ce lancement' })).toBeEnabled();
  });
  await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer ce lancement' }));
}

const historique = () => within(screen.getByRole('region', { name: 'Historique' }));

describe('enregistrer', () => {
  it("garde le lancement affiché, l'annonce et le liste dans l'historique", async () => {
    const { api, utilisateur } = await demarrer();
    expect(historique().getByText('Aucun lancement enregistré.')).toBeInTheDocument();
    await enregistrer(utilisateur, 'Réglage de départ');
    expect(
      await screen.findByText('Lancement enregistré : « Réglage de départ ».'),
    ).toBeInTheDocument();
    expect(await historique().findByText('Réglage de départ')).toBeInTheDocument();
    expect(
      historique().getByText(/Combat 1 contre 1 v1\.0\.0 · .* · graine 1 · 200 itérations/u),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom du lancement' })).toHaveValue('');
    expect(api.historique.lister()).toHaveLength(1);
  });

  it('nomme le lancement par ses réglages quand aucun nom n’est donné', async () => {
    const { utilisateur } = await demarrer();
    await enregistrer(utilisateur, '');
    expect(
      await screen.findByText(/^Lancement enregistré : « graine 1 · pvA=100, /u),
    ).toBeInTheDocument();
  });

  it("n'enregistre rien tant qu'aucun résultat n'est affiché", () => {
    const api = new FausseApi();
    api.scenario = () => new Promise(() => undefined);
    render(<App api={api} delai={0} />);
    return waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enregistrer ce lancement' })).toBeDisabled();
    });
  });

  it("explique un enregistrement refusé, sans rien ajouter à l'historique", async () => {
    const { api, utilisateur } = await demarrer();
    api.panneDeLHistorique = new Error('Disque plein.');
    await enregistrer(utilisateur, 'x');
    expect(await historique().findByRole('alert')).toHaveTextContent('Disque plein.');
    expect(screen.queryByText(/Lancement enregistré/u)).not.toBeInTheDocument();
  });
});

describe('recharger', () => {
  it('remet les réglages enregistrés et confirme que le résultat est identique', async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'Départ');
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '150' },
    });
    await waitFor(() => {
      expect(api.derniere?.surcharges['pvA']).toBe(150);
    });

    await utilisateur.click(
      await historique().findByRole('button', { name: 'Recharger « Départ »' }),
    );
    expect(
      await screen.findByText('Résultat identique à l’enregistrement « Départ ».'),
    ).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'PV de A' })).toHaveValue(100);

    // Un réglage modifié : le résultat ne se compare plus à l'enregistrement.
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '120' },
    });
    await waitFor(() => {
      expect(screen.queryByText(/l’enregistrement « Départ »/u)).not.toBeInTheDocument();
    });
  });

  it('signale un résultat différent avec les mêmes réglages : le système a changé', async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'Ancien');
    const enregistre = api.historique.lire(1);
    if (enregistre === null) throw new Error('non enregistré');
    // Même réglages, même graine, mais un résumé que le système actuel ne redonne pas.
    api.historique.enregistrer({
      ...enregistre,
      nom: 'Falsifié',
      resume: { ...enregistre.resume, mesures: [] },
    });
    // Un nouvel enregistrement recharge la liste, qui montre alors le lancement falsifié.
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer ce lancement' }));
    await utilisateur.click(
      await historique().findByRole('button', { name: 'Recharger « Falsifié »' }),
    );
    expect(
      await screen.findByText(/Résultat différent de l’enregistrement « Falsifié »/u),
    ).toHaveClass('probleme');
  });

  it("refuse de recharger le lancement d'un système qui n'existe plus", async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'x');
    const enregistre = api.historique.lire(1);
    if (enregistre === null) throw new Error('non enregistré');
    api.historique.enregistrer({ ...enregistre, systeme: 'disparu', nom: 'Orphelin' });
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer ce lancement' }));
    await utilisateur.click(
      await historique().findByRole('button', { name: 'Recharger « Orphelin »' }),
    );
    expect(
      await screen.findByText('Le système « disparu » n’est plus disponible.'),
    ).toBeInTheDocument();
  });

  it('explique un rechargement impossible', async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'x');
    await historique().findByText('x');
    api.panneDeLHistorique = new Error('Serveur arrêté.');
    await utilisateur.click(historique().getByRole('button', { name: 'Recharger « x »' }));
    expect(await screen.findByText('Serveur arrêté.')).toBeInTheDocument();
  });

  it('revient au lot en cours en rechargeant depuis la comparaison', async () => {
    const { utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'un');
    await enregistrer(utilisateur, 'deux');
    await utilisateur.click(await historique().findByRole('checkbox', { name: /un/u }));
    await utilisateur.click(historique().getByRole('checkbox', { name: /deux/u }));
    await utilisateur.click(screen.getByRole('button', { name: 'Comparer A et B' }));
    await screen.findByRole('article', { name: 'Paramètres comparés' });
    await utilisateur.click(historique().getByRole('button', { name: 'Recharger « un »' }));
    expect(
      await screen.findByText('Résultat identique à l’enregistrement « un ».'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lot en cours' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('supprimer', () => {
  it("retire le lancement de l'historique et de la sélection", async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'à jeter');
    await utilisateur.click(await historique().findByRole('checkbox', { name: /à jeter/u }));
    await utilisateur.click(historique().getByRole('button', { name: 'Supprimer « à jeter »' }));
    expect(await historique().findByText('Aucun lancement enregistré.')).toBeInTheDocument();
    expect(api.historique.lister()).toEqual([]);
  });

  it('explique une suppression impossible', async () => {
    const { api, utilisateur } = await demarrer();
    await enregistrer(utilisateur, 'gardé');
    await historique().findByText('gardé');
    api.panneDeLHistorique = new Error('Base verrouillée.');
    await utilisateur.click(historique().getByRole('button', { name: 'Supprimer « gardé »' }));
    expect(await historique().findByRole('alert')).toHaveTextContent('Base verrouillée.');
  });

  it('explique un historique impossible à lire', async () => {
    const api = new FausseApi();
    api.panneDeLHistorique = 'Historique illisible.';
    await demarrer(api);
    expect(await historique().findByRole('alert')).toHaveTextContent('Historique illisible.');
  });
});

describe('comparer', () => {
  it('compare deux lancements choisis, A puis B, et en interdit un troisième', async () => {
    const { utilisateur } = await demarrer();
    const comparer = screen.getByRole('button', { name: 'Comparer A et B' });
    expect(comparer).toBeDisabled();
    await enregistrer(utilisateur, 'PV 100');
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '200' },
    });
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'PV de A' })).toHaveValue(200);
    });
    await enregistrer(utilisateur, 'PV 200');
    await enregistrer(utilisateur, 'Troisième');
    await historique().findByText('Troisième');

    await utilisateur.click(historique().getByRole('checkbox', { name: /PV 100/u }));
    await utilisateur.click(historique().getByRole('checkbox', { name: /PV 200/u }));
    expect(historique().getByRole('checkbox', { name: /Troisième/u })).toBeDisabled();
    expect(historique().getByRole('checkbox', { name: /A PV 100/u })).toBeChecked();
    expect(historique().getByRole('checkbox', { name: /B PV 200/u })).toBeChecked();

    const graphiquesAvant = fauxEcharts.graphiques.length;
    await utilisateur.click(comparer);
    const parametres = await screen.findByRole('article', { name: 'Paramètres comparés' });
    const ligne = within(parametres).getByRole('row', { name: /PV de A/u });
    expect(
      within(ligne)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['PV de A', '100', '200', 'modifié']);
    expect(screen.getByRole('img', { name: 'Vainqueur : taux de A et de B' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Durée (tours) : moyenne de A et de B, IC 95 %' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'PV de A par tour (PV) : moyenne par tour de A et de B' }),
    ).toBeInTheDocument();
    expect(fauxEcharts.graphiques.length).toBeGreaterThan(graphiquesAvant);
    expect(
      screen.getAllByText(/^Écart des moyennes B − A : .* · (non )?significatif$/u),
    ).toHaveLength(2);

    await utilisateur.click(screen.getByRole('button', { name: 'Lot en cours' }));
    expect(await screen.findByRole('article', { name: 'Vainqueur' })).toBeInTheDocument();

    // Décocher B : la comparaison n'est plus possible.
    await utilisateur.click(historique().getByRole('checkbox', { name: /B PV 200/u }));
    expect(screen.getByRole('button', { name: 'Comparer A et B' })).toBeDisabled();
    expect(historique().getByRole('checkbox', { name: /Troisième/u })).toBeEnabled();
  });
});
