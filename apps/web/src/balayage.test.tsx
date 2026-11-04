/** @vitest-environment jsdom */
import type { EvenementDeBalayage } from '@batchtester/runner';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { FausseApi } from './testing/fausseApi.ts';
import { fauxEcharts } from './testing/fauxEcharts.ts';
import {
  MESSAGE_BALAYAGE_ANNULE,
  MESSAGE_BALAYAGE_INTERROMPU,
  useBalayage,
} from './useBalayage.ts';

async function ouvrir(api = new FausseApi()) {
  const utilisateur = userEvent.setup();
  render(<App api={api} delai={0} />);
  await screen.findByRole('article', { name: 'Vainqueur' });
  await utilisateur.click(screen.getByRole('button', { name: 'Balayage' }));
  return { api, utilisateur, region: within(screen.getByRole('region', { name: 'Balayage' })) };
}

async function remplacer(
  utilisateur: ReturnType<typeof userEvent.setup>,
  champ: HTMLElement,
  texte: string,
) {
  await utilisateur.clear(champ);
  if (texte !== '') await utilisateur.type(champ, texte);
}

/** Scénario qui attend d'être abandonné, après avoir signalé une progression. */
function scenarioEnAttente(api: FausseApi) {
  api.scenarioDeBalayage = (_d, ecouter, signal) =>
    new Promise<void>((terminer) => {
      ecouter({ type: 'progression', faites: 5, total: 20 });
      signal.addEventListener('abort', () => {
        terminer();
      });
    });
}

describe('balayer un paramètre', () => {
  it('propose le premier paramètre sur toute sa plage, avec le coût du balayage', async () => {
    const { region } = await ouvrir();
    expect(region.getByRole('combobox', { name: 'Paramètre' })).toHaveValue('pvA');
    expect(region.getByRole('spinbutton', { name: 'De' })).toHaveValue(1);
    expect(region.getByRole('spinbutton', { name: 'À' })).toHaveValue(1000);
    expect(region.getByRole('spinbutton', { name: 'Points' })).toHaveValue(11);
    expect(
      region.getByText(/^11 points × 100 itérations = 1.100 itérations\./u),
    ).toBeInTheDocument();
  });

  it('joue un lot par valeur avec les réglages et la graine du lot en cours, puis trace l’indicateur', async () => {
    const { api, utilisateur, region } = await ouvrir();
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'De' }), '80');
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'À' }), '120');
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'Points' }), '3');
    await remplacer(
      utilisateur,
      region.getByRole('spinbutton', { name: 'Itérations par point' }),
      '20',
    );
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));

    const resultat = await region.findByRole('article', { name: 'Résultat du balayage' });
    expect(api.balayages[0]).toMatchObject({
      systeme: 'combat',
      graine: 1,
      iterations: 20,
      surcharges: { pvA: 100, pvB: 120 },
      axes: [{ parametre: 'pvA', valeurs: [80, 100, 120] }],
    });
    expect(within(resultat).getByRole('heading')).toHaveTextContent(
      'pvA · 3 points de 20 itérations · graine 1',
    );
    const indicateurs = within(resultat).getByRole('combobox', { name: 'Indicateur' });
    expect(
      within(indicateurs)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Vainqueur : taux de « A »',
      'Vainqueur : taux de « B »',
      'Vainqueur : taux de « nul »',
      'Durée (tours) : moyenne',
      'Écart de PV final (A - B) (PV) : moyenne',
    ]);
    const graphique = within(resultat).getByRole('img', { name: 'Vainqueur : taux de « A »' });
    const dessin = fauxEcharts.graphiques.find((g) => g.element === graphique);
    expect(dessin?.options).toHaveLength(1);

    await utilisateur.selectOptions(indicateurs, 'Durée (tours) : moyenne');
    expect(
      within(resultat).getByRole('img', { name: 'Durée (tours) : moyenne' }),
    ).toBeInTheDocument();
    expect(dessin?.options).toHaveLength(2);
    expect(within(resultat).getAllByRole('row')).toHaveLength(4);
  });

  it('croise deux paramètres en grille, un choix y compris', async () => {
    const { api, utilisateur, region } = await ouvrir();
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'Points' }), '2');
    await remplacer(
      utilisateur,
      region.getByRole('spinbutton', { name: 'Itérations par point' }),
      '10',
    );
    await utilisateur.click(
      region.getByRole('checkbox', { name: 'Croiser avec un second paramètre (grille)' }),
    );
    const second = region.getByRole('group', { name: 'Second paramètre' });
    expect(within(second).getByRole('combobox', { name: 'Paramètre' })).toHaveValue('degatsA');
    await utilisateur.selectOptions(
      within(second).getByRole('combobox', { name: 'Paramètre' }),
      'Qui frappe en premier',
    );
    expect(
      within(second).getByText('Toutes les valeurs possibles sont essayées.'),
    ).toBeInTheDocument();
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));

    const resultat = await region.findByRole('article', { name: 'Résultat du balayage' });
    expect(api.balayages[0]?.axes).toEqual([
      { parametre: 'pvA', valeurs: [1, 1000] },
      { parametre: 'initiative', valeurs: ['A', 'B', 'aleatoire'] },
    ]);
    expect(within(resultat).getByRole('heading')).toHaveTextContent('pvA × initiative · 6 points');
    const dessin = fauxEcharts.graphiques.at(-1);
    expect(dessin?.options[0]).toHaveProperty('visualMap');

    // Sans second paramètre, on revient à une courbe.
    await utilisateur.click(
      region.getByRole('checkbox', { name: 'Croiser avec un second paramètre (grille)' }),
    );
    expect(region.queryByRole('group', { name: 'Second paramètre' })).not.toBeInTheDocument();
  });

  it('garde le résultat quand on passe sur un autre onglet et qu’on revient', async () => {
    const { utilisateur, region } = await ouvrir();
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'Points' }), '2');
    await remplacer(
      utilisateur,
      region.getByRole('spinbutton', { name: 'Itérations par point' }),
      '5',
    );
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));
    await region.findByRole('article', { name: 'Résultat du balayage' });
    await utilisateur.click(screen.getByRole('button', { name: 'Lot en cours' }));
    expect(screen.queryByRole('region', { name: 'Balayage' })).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Balayage' }));
    expect(screen.getByRole('article', { name: 'Résultat du balayage' })).toBeInTheDocument();
  });
});

describe('réglages invalides', () => {
  it.each([
    ['Points', '0', '« PV de A » : de 1 à 50 points.'],
    ['De', '', /^« PV de A » : la plage doit rester entre 1 et 1.000.$/u],
    ['À', '2000', /^« PV de A » : la plage doit rester entre 1 et 1.000.$/u],
    ['Itérations par point', '0', 'Le nombre d’itérations par point doit être un entier positif.'],
  ])('signale %s = « %s »', async (champ, texte, message) => {
    const { utilisateur, region } = await ouvrir();
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: champ }), texte);
    expect(
      within(region.getByRole('list', { name: 'À corriger' })).getByText(message),
    ).toBeInTheDocument();
    expect(region.getByRole('button', { name: 'Lancer le balayage' })).toBeDisabled();
  });

  it('nomme un paramètre sans libellé par son nom', async () => {
    const { utilisateur } = await ouvrir();
    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Système' }),
      'Pile ou face',
    );
    await utilisateur.click(screen.getByRole('button', { name: 'Balayage' }));
    const region = within(screen.getByRole('region', { name: 'Balayage' }));
    expect(region.getByRole('combobox', { name: 'Paramètre' })).toHaveValue('biais');
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'Points' }), '99');
    expect(region.getByText('« biais » : de 1 à 50 points.')).toBeInTheDocument();
    // Un seul autre paramètre : c'est lui qui est proposé pour la grille.
    await utilisateur.click(
      region.getByRole('checkbox', { name: 'Croiser avec un second paramètre (grille)' }),
    );
    const second = region.getByRole('group', { name: 'Second paramètre' });
    expect(within(second).getByRole('combobox', { name: 'Paramètre' })).toHaveValue('truque');
    // Passer d'un booléen à un nombre : la plage par défaut revient, avec 11 points.
    await utilisateur.selectOptions(
      within(second).getByRole('combobox', { name: 'Paramètre' }),
      'biais',
    );
    expect(within(second).getByRole('spinbutton', { name: 'Points' })).toHaveValue(11);
    await remplacer(utilisateur, within(second).getByRole('spinbutton', { name: 'De' }), '');
    expect(region.getByText('« biais » : la plage doit rester entre 0 et 1.')).toBeInTheDocument();
  });

  it('refuse deux fois le même paramètre, et une grille trop grande', async () => {
    const { utilisateur, region } = await ouvrir();
    await remplacer(utilisateur, region.getByRole('spinbutton', { name: 'Points' }), '50');
    await utilisateur.click(
      region.getByRole('checkbox', { name: 'Croiser avec un second paramètre (grille)' }),
    );
    const second = region.getByRole('group', { name: 'Second paramètre' });
    await remplacer(utilisateur, within(second).getByRole('spinbutton', { name: 'Points' }), '10');
    expect(region.getByText('500 points : au plus 400.')).toBeInTheDocument();
    await utilisateur.selectOptions(
      within(second).getByRole('combobox', { name: 'Paramètre' }),
      'PV de A',
    );
    expect(region.getByText('Choisir deux paramètres différents.')).toBeInTheDocument();
  });
});

describe('déroulement', () => {
  it('montre la progression et permet d’annuler', async () => {
    const api = new FausseApi();
    scenarioEnAttente(api);
    const { utilisateur, region } = await ouvrir(api);
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));
    expect(region.getByRole('progressbar', { name: 'Avancement du balayage' })).toHaveAttribute(
      'value',
      '5',
    );
    expect(region.getByRole('button', { name: 'Lancer le balayage' })).toBeDisabled();
    await utilisateur.click(region.getByRole('button', { name: 'Annuler' }));
    expect(await region.findByRole('alert')).toHaveTextContent(MESSAGE_BALAYAGE_ANNULE);
    expect(region.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('affiche le problème rapporté, ou un flux interrompu', async () => {
    const api = new FausseApi();
    api.scenarioDeBalayage = (_d, ecouter) => {
      ecouter({ type: 'probleme', message: '« pvA » = 0 : hors des bornes.' });
      return Promise.resolve();
    };
    const { utilisateur, region } = await ouvrir(api);
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));
    expect(await region.findByRole('alert')).toHaveTextContent('« pvA » = 0 : hors des bornes.');

    api.scenarioDeBalayage = () => Promise.resolve();
    await utilisateur.click(region.getByRole('button', { name: 'Lancer le balayage' }));
    expect(await region.findByText(MESSAGE_BALAYAGE_INTERROMPU)).toBeInTheDocument();
  });
});

describe('useBalayage', () => {
  it('abandonne le balayage remplacé sans laisser son abandon écraser le suivant', async () => {
    const api = new FausseApi();
    const ecouteurs: ((e: EvenementDeBalayage) => void)[] = [];
    const signaux: AbortSignal[] = [];
    api.scenarioDeBalayage = (_d, ecouter, signal) =>
      new Promise<void>((terminer) => {
        ecouteurs.push(ecouter);
        signaux.push(signal);
        signal.addEventListener('abort', () => {
          terminer();
        });
      });
    const { result, unmount } = renderHook(() => useBalayage(api));
    const demande = { systeme: 'combat', graine: 1, iterations: 1, surcharges: {}, axes: [] };
    act(() => {
      result.current.lancer(demande);
    });
    act(() => {
      result.current.lancer(demande);
    });
    await waitFor(() => {
      expect(signaux[0]?.aborted).toBe(true);
    });
    expect(result.current.enCours).toBe(true);
    expect(result.current.probleme).toBeNull();
    unmount();
    expect(signaux[1]?.aborted).toBe(true);
  });
});
