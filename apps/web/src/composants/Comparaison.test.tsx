/** @vitest-environment jsdom */
import type { ResumeDeLot, ResumeDeMesure } from '@batchtester/runner';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FausseApi } from '../testing/fausseApi.ts';
import { Comparaison } from './Comparaison.tsx';

/** B : une autre version du système, avec une catégorie et un paramètre de plus. */
function versionSuivante(a: ResumeDeLot): ResumeDeLot {
  const mesures = a.mesures.flatMap((m): ResumeDeMesure[] => {
    if (m.kind === 'categorie') {
      return [
        {
          ...m,
          mesure: { ...m.mesure, categories: [...m.mesure.categories, 'fuite'] },
          // « nul » n'a plus de fréquence dans B : la ligne reste, sans valeur B.
          frequences: [
            ...m.frequences.filter((f) => f.categorie !== 'nul'),
            { categorie: 'fuite', effectif: 0, proportion: 0, basse: 0, haute: 0.1 },
          ],
        },
      ];
    }
    if (m.mesure.nom === 'tours' && m.kind === 'nombre') return [{ ...m, resume: null }];
    if (m.mesure.nom === 'pvB') return [];
    return [m];
  });
  return {
    ...a,
    definition: {
      ...a.definition,
      version: '2.0.0',
      parametres: [
        ...a.definition.parametres,
        { kind: 'booleen', nom: 'bouclier', defaut: false },
        { kind: 'booleen', nom: 'esquive', defaut: false },
      ],
    },
    valeurs: { ...a.valeurs, bouclier: true, esquive: false },
    mesures,
  };
}

async function preparer() {
  const api = new FausseApi();
  await api.enregistrer({ systeme: 'combat', graine: 1, iterations: 30, surcharges: {} }, 'Avant');
  const a = api.historique.lire(1);
  if (a === null) throw new Error('non enregistré');
  api.historique.enregistrer({
    systeme: 'combat',
    nom: 'Après',
    resume: versionSuivante(a.resume),
  });
  return api;
}

describe('comparaison', () => {
  it('nomme les deux lots et prévient quand les versions diffèrent', async () => {
    render(<Comparaison api={await preparer()} idA={1} idB={2} />);
    expect(screen.getByText('Chargement des lancements…')).toBeInTheDocument();
    expect(await screen.findByRole('note')).toHaveTextContent('pas de la même version');
    expect(
      screen.getByText(/^Avant — Combat 1 contre 1 v1\.0\.0, graine 1, 30 itérations$/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Après — Combat 1 contre 1 v2\.0\.0/u)).toBeInTheDocument();
  });

  it('montre un paramètre absent d’un lot, et les valeurs de chaque sorte', async () => {
    render(<Comparaison api={await preparer()} idA={1} idB={2} />);
    const parametres = await screen.findByRole('article', { name: 'Paramètres comparés' });
    const cellules = (nom: RegExp) =>
      within(within(parametres).getByRole('row', { name: nom }))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(cellules(/bouclier/u)).toEqual(['bouclier', '—', 'oui', 'modifié']);
    expect(cellules(/esquive/u)).toEqual(['esquive', '—', 'non', 'modifié']);
    expect(cellules(/Qui frappe en premier/u)).toEqual([
      'Qui frappe en premier',
      'aleatoire',
      'aleatoire',
      '',
    ]);
    expect(cellules(/Précision de A/u)).toEqual(['Précision de A', '0,8', '0,8', '']);
  });

  it('compare ce qui existe des deux côtés, et dit ce qui ne se compare pas', async () => {
    render(<Comparaison api={await preparer()} idA={1} idB={2} />);
    const vainqueur = await screen.findByRole('article', { name: 'Vainqueur' });
    const fuite = within(vainqueur).getByRole('row', { name: /fuite/u });
    expect(
      within(fuite)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['fuite', '—', expect.any(String), '—']);
    const nul = within(vainqueur).getByRole('row', { name: /^nul/u });
    expect(
      within(nul)
        .getAllByRole('cell')
        .map((cellule) => cellule.textContent),
    ).toEqual(['nul', expect.any(String), '—', '—']);
    const tours = screen.getByRole('article', { name: 'Durée (tours)' });
    expect(
      within(tours).getByText('Écart des moyennes B − A : non calculable'),
    ).toBeInTheDocument();
    expect(
      within(within(tours).getByRole('row', { name: /^B/u }))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['B', '—', '—', '—', '—']);
    expect(
      screen.getByText('Non comparées (absentes d’un des lots, ou de sorte différente) : pvB.'),
    ).toBeInTheDocument();
  });

  it("titre une mesure par son nom quand elle n'a pas de libellé", async () => {
    const api = new FausseApi();
    for (const graine of [1, 2]) {
      await api.enregistrer(
        { systeme: 'pile', graine, iterations: 40, surcharges: {} },
        String(graine),
      );
    }
    render(<Comparaison api={api} idA={1} idB={2} />);
    expect(await screen.findByRole('article', { name: 'issue' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('explique une comparaison impossible', async () => {
    render(<Comparaison api={await preparer()} idA={1} idB={99} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Comparaison impossible : Lancement n° 99 introuvable.',
    );
  });

  it('explique une panne qui ne vient pas d’une Error', async () => {
    const api = await preparer();
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- une panne peut rejeter autre chose qu'une Error
    api.lancement = () => Promise.reject('hors ligne');
    render(<Comparaison api={api} idA={1} idB={2} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Comparaison impossible : hors ligne',
    );
  });
});
