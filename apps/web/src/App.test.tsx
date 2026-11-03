/** @vitest-environment jsdom */
import { GRAINE_MAXIMALE, valeursParDefaut } from '@batchtester/core';
import type { EvenementDeLot } from '@batchtester/runner';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { COMBAT, FausseApi, PILE_OU_FACE, scenarioReel } from './testing/fausseApi.ts';
import { fauxEcharts } from './testing/fauxEcharts.ts';
import { MESSAGE_LOT_INTERROMPU } from './useLot.ts';

const MESURES_DU_COMBAT = [
  'Vainqueur',
  'Durée (tours)',
  'Écart de PV final (A - B) (PV)',
  'PV de A par tour (PV)',
  'PV de B par tour (PV)',
];

async function demarrer(api = new FausseApi(), tirerUneGraine = () => 777) {
  const utilisateur = userEvent.setup();
  render(<App api={api} delai={0} tirerUneGraine={tirerUneGraine} />);
  await screen.findByRole('article', { name: 'Vainqueur' });
  return { api, utilisateur };
}

/** Scénario qui ne se termine que lorsqu'on le décide, ou quand il est abandonné. */
function scenarioEnAttente() {
  const enCours: { ecouter: (e: EvenementDeLot) => void; terminer: () => void }[] = [];
  const scenario = (_: unknown, ecouter: (e: EvenementDeLot) => void, signal: AbortSignal) =>
    new Promise<void>((terminer) => {
      enCours.push({ ecouter, terminer });
      signal.addEventListener('abort', () => {
        terminer();
      });
    });
  return { enCours, scenario };
}

describe('premier lancement', () => {
  it('indique le chargement des systèmes', () => {
    const api = new FausseApi();
    api.liste = new Promise(() => undefined);
    render(<App api={api} />);
    expect(screen.getByText('Chargement des systèmes…')).toBeInTheDocument();
  });

  it('lance un lot du premier système avec ses valeurs par défaut', async () => {
    const { api } = await demarrer();
    expect(api.demandes.map((d) => d.demande)).toEqual([
      {
        systeme: 'combat',
        graine: 1,
        iterations: 200,
        surcharges: valeursParDefaut(COMBAT.definition.parametres),
      },
    ]);
    expect(
      screen.getByText(/Combat 1 contre 1 v1\.0\.0 · 200 itérations · graine 1/u),
    ).toBeInTheDocument();
    expect(screen.getByText(COMBAT.definition.description ?? '')).toBeInTheDocument();
  });

  it('affiche une carte par mesure, avec ses graphiques et ses données', async () => {
    await demarrer();
    const cartes = screen.getAllByRole('article');
    expect(cartes.map((c) => c.getAttribute('aria-label'))).toEqual(MESURES_DU_COMBAT);
    // Catégorie : taux + convergence ; nombre : distribution + convergence ; série : une courbe.
    expect(fauxEcharts.graphiques).toHaveLength(2 + 2 + 2 + 1 + 1);
    const duree = within(screen.getByRole('article', { name: 'Durée (tours)' }));
    expect(duree.getByText('Moyenne')).toBeInTheDocument();
    expect(duree.getByRole('img', { name: 'Durée (tours) : distribution' })).toBeInTheDocument();
    expect(duree.getByRole('columnheader', { name: 'Itérations' })).toBeInTheDocument();
    const vainqueur = within(screen.getByRole('article', { name: 'Vainqueur' }));
    expect(vainqueur.getByRole('cell', { name: 'nul' })).toBeInTheDocument();
    const serie = within(screen.getByRole('article', { name: 'PV de A par tour (PV)' }));
    expect(serie.getByRole('columnheader', { name: 'Tour' })).toBeInTheDocument();
  });
});

describe('réglages', () => {
  it('relance le lot quand un curseur bouge, et met à jour les graphiques sans les recréer', async () => {
    const { api } = await demarrer();
    const graphiques = fauxEcharts.graphiques.length;
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '150' },
    });

    await waitFor(() => {
      expect(api.derniere?.surcharges['pvA']).toBe(150);
    });
    await waitFor(() => {
      expect(fauxEcharts.graphiques[0]?.options).toHaveLength(2);
    });
    expect(fauxEcharts.graphiques).toHaveLength(graphiques);
    expect(screen.getByRole('spinbutton', { name: 'PV de A' })).toHaveValue(150);
  });

  it('relance le lot avec la valeur saisie, et ignore une saisie invalide', async () => {
    const { api, utilisateur } = await demarrer();
    const champ = screen.getByRole('spinbutton', { name: 'Précision de A' });
    await utilisateur.clear(champ);
    expect(champ).toHaveAttribute('aria-invalid', 'true');
    await utilisateur.type(champ, '0.123');
    expect(champ).toHaveAttribute('aria-invalid', 'true');
    expect(champ).toHaveAccessibleDescription('De 0 à 1, par pas de 0,01.');
    const aide = document.getElementById(champ.getAttribute('aria-describedby') ?? '');
    expect(aide).toHaveClass('invalide');
    await utilisateur.clear(champ);
    await utilisateur.type(champ, '0.5');
    expect(champ).toHaveAttribute('aria-invalid', 'false');
    await waitFor(() => {
      expect(api.derniere?.surcharges['precisionA']).toBe(0.5);
    });
    expect(api.demandes.map((d) => d.demande.surcharges['precisionA'])).not.toContain(0.123);
  });

  it('relance le lot pour un choix, une case, le nombre d’itérations et la graine', async () => {
    const { api, utilisateur } = await demarrer();
    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Qui frappe en premier' }),
      'A',
    );
    await waitFor(() => {
      expect(api.derniere?.surcharges['initiative']).toBe('A');
    });

    const iterations = screen.getByRole('spinbutton', { name: 'Itérations' });
    await utilisateur.clear(iterations);
    await utilisateur.type(iterations, '50');
    await waitFor(() => {
      expect(api.derniere?.iterations).toBe(50);
    });

    await utilisateur.click(screen.getByRole('button', { name: 'Tirer une graine' }));
    await waitFor(() => {
      expect(api.derniere?.graine).toBe(777);
    });
    expect(screen.getByRole('spinbutton', { name: 'Graine' })).toHaveValue(777);

    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Système' }),
      'Pile ou face',
    );
    await utilisateur.click(await screen.findByRole('checkbox', { name: 'Pièce truquée' }));
    await waitFor(() => {
      expect(api.derniere).toMatchObject({ systeme: 'pile', surcharges: { truque: true } });
    });
    expect(screen.queryByText(COMBAT.definition.description ?? '')).not.toBeInTheDocument();
  });

  it('relance le lot avec la graine saisie, sans recharger la page à la validation', async () => {
    const { api, utilisateur } = await demarrer();
    const graine = screen.getByRole('spinbutton', { name: 'Graine' });
    await utilisateur.clear(graine);
    await utilisateur.type(graine, '123{Enter}');
    await waitFor(() => {
      expect(api.derniere?.graine).toBe(123);
    });
    expect(fireEvent.submit(screen.getByRole('form', { name: 'Réglages' }))).toBe(false);
  });

  it('remet les valeurs par défaut', async () => {
    const { api, utilisateur } = await demarrer();
    fireEvent.change(screen.getByRole('slider', { name: 'PV de B (curseur)' }), {
      target: { value: '300' },
    });
    await waitFor(() => {
      expect(api.derniere?.surcharges['pvB']).toBe(300);
    });
    await utilisateur.click(screen.getByRole('button', { name: 'Valeurs par défaut' }));
    await waitFor(() => {
      expect(api.derniere?.surcharges['pvB']).toBe(120);
    });
    expect(screen.getByRole('spinbutton', { name: 'PV de B' })).toHaveValue(120);
  });

  it('tire par défaut une graine entière sur 32 bits', async () => {
    const api = new FausseApi();
    const utilisateur = userEvent.setup();
    render(<App api={api} delai={0} />);
    await utilisateur.click(await screen.findByRole('button', { name: 'Tirer une graine' }));
    await waitFor(() => {
      expect(api.demandes).toHaveLength(2);
    });
    const graine = api.derniere?.graine ?? -1;
    expect(Number.isInteger(graine) && graine >= 0 && graine <= GRAINE_MAXIMALE).toBe(true);
  });
});

describe('déroulement du lot', () => {
  it('montre la progression, puis abandonne le lot dépassé par un nouveau réglage', async () => {
    const api = new FausseApi();
    const { enCours, scenario } = scenarioEnAttente();
    api.scenario = scenario;
    render(<App api={api} delai={0} />);
    const barre = await screen.findByRole('progressbar', { name: 'Avancement du lot' });
    expect(barre).toHaveAttribute('max', '200');
    act(() => {
      enCours[0]?.ecouter({ type: 'progression', faites: 50, total: 200 });
    });
    expect(barre).toHaveAttribute('value', '50');
    expect(screen.getByRole('region', { name: 'Résultats' })).toHaveAttribute('aria-busy', 'true');

    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '99' },
    });
    await waitFor(() => {
      expect(api.demandes).toHaveLength(2);
    });
    expect(api.demandes[0]?.signal.aborted).toBe(true);
    expect(api.demandes[1]?.signal.aborted).toBe(false);
  });

  it('garde le résultat précédent, grisé, pendant le calcul du suivant', async () => {
    const api = new FausseApi();
    await demarrer(api);
    const { scenario } = scenarioEnAttente();
    api.scenario = scenario;
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '99' },
    });
    await screen.findByRole('progressbar');
    expect(screen.getAllByRole('article')).toHaveLength(MESURES_DU_COMBAT.length);
    expect(screen.getAllByRole('article')[0]?.parentElement).toHaveClass('perime');
  });

  it('affiche le problème rapporté par le serveur', async () => {
    const api = new FausseApi();
    api.scenario = (_d, ecouter) => {
      ecouter({ type: 'probleme', message: "L'itération 3 a échoué : boum" });
      return Promise.resolve();
    };
    render(<App api={api} delai={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("L'itération 3 a échoué : boum");
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it("signale un flux terminé sans résultat, puis l'efface au lot suivant", async () => {
    const api = new FausseApi();
    api.scenario = () => Promise.resolve();
    render(<App api={api} delai={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE_LOT_INTERROMPU);
    api.scenario = scenarioReel;
    fireEvent.change(screen.getByRole('slider', { name: 'PV de A (curseur)' }), {
      target: { value: '99' },
    });
    await screen.findByRole('article', { name: 'Vainqueur' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('systèmes indisponibles', () => {
  it.each([
    [new Error('Panne.'), 'Impossible de lister les systèmes : Panne.'],
    ['boum', 'Impossible de lister les systèmes : boum'],
  ])('explique un échec de la liste (%s)', async (raison, message) => {
    const api = new FausseApi();
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- une panne peut rejeter autre chose qu'une Error
    api.liste = Promise.reject(raison);
    render(<App api={api} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('explique comment ajouter un système quand il n’y en a aucun', async () => {
    const api = new FausseApi();
    api.liste = Promise.resolve([]);
    render(<App api={api} />);
    expect(await screen.findByText(/Aucun système trouvé/u)).toBeInTheDocument();
    expect(api.demandes).toHaveLength(0);
  });

  it('propose chaque système par son nom', async () => {
    await demarrer();
    const options = within(screen.getByRole('combobox', { name: 'Système' })).getAllByRole(
      'option',
    );
    expect(options.map((o) => o.textContent)).toEqual([
      COMBAT.definition.nom,
      PILE_OU_FACE.definition.nom,
    ]);
  });
});
