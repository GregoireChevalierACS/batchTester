import { elementA, intervalleDeLaMoyenne } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import {
  indicateursDuBalayage,
  lancerUnBalayage,
  POINTS_MAXIMAUX_PAR_BALAYAGE,
  type Balayage,
} from './balayer.ts';
import { lancerUnLot } from './lancerUnLot.ts';
import { resumerLeLot } from './resumerLeLot.ts';
import { DEFINITION_DE_TEST, graine, SimulateurScripte } from './testing/index.ts';

// Résultat qui dépend du nombre de lancers et de la graine : chaque point se distingue.
const scenario = new SimulateurScripte((valeurs, g) => {
  const lancers = Number(valeurs['lancers']);
  return { piles: lancers + (g % 3), issue: lancers > 5 ? 'pile' : 'face', cumul: [lancers] };
});

const DEMANDE = { surcharges: {}, graine: graine(42), iterations: 10 };

describe('lancer un balayage', () => {
  it('joue un lot par valeur, avec la même graine pour chaque point', async () => {
    const balayage = await lancerUnBalayage(scenario, {
      ...DEMANDE,
      axes: [{ parametre: 'lancers', valeurs: [2, 8] }],
    });
    if (!balayage.ok) throw new Error(balayage.error.kind);
    const attendu = async (lancers: number) => {
      const lot = await lancerUnLot(scenario, { ...DEMANDE, surcharges: { lancers } });
      if (!lot.ok) throw new Error(lot.error.kind);
      return resumerLeLot(lot.value);
    };
    expect(balayage.value).toEqual({
      definition: DEFINITION_DE_TEST,
      axes: [{ parametre: 'lancers', valeurs: [2, 8] }],
      graine: 42,
      iterations: 10,
      points: [
        { valeurs: [2], resume: await attendu(2) },
        { valeurs: [8], resume: await attendu(8) },
      ],
    });
  });

  it('parcourt une grille, le premier axe variant le plus lentement', async () => {
    const definition = {
      ...DEFINITION_DE_TEST,
      parametres: [
        ...DEFINITION_DE_TEST.parametres,
        { kind: 'booleen' as const, nom: 'truque', defaut: false },
      ],
    };
    const simulateur = new SimulateurScripte(
      (valeurs) => ({
        piles: valeurs['truque'] === true ? 0 : Number(valeurs['lancers']),
        issue: 'pile',
        cumul: [],
      }),
      definition,
    );
    const balayage = await lancerUnBalayage(simulateur, {
      ...DEMANDE,
      surcharges: { lancers: 4 },
      axes: [
        { parametre: 'lancers', valeurs: [1, 2] },
        { parametre: 'truque', valeurs: [false, true] },
      ],
    });
    if (!balayage.ok) throw new Error(balayage.error.kind);
    expect(balayage.value.points.map((p) => p.valeurs)).toEqual([
      [1, false],
      [1, true],
      [2, false],
      [2, true],
    ]);
    expect(balayage.value.points.map((p) => p.resume.valeurs)).toEqual([
      { lancers: 1, truque: false },
      { lancers: 1, truque: true },
      { lancers: 2, truque: false },
      { lancers: 2, truque: true },
    ]);
  });

  it('signale la progression sur l’ensemble des points', async () => {
    const progression: [number, number][] = [];
    await lancerUnBalayage(
      scenario,
      { ...DEMANDE, iterations: 2, axes: [{ parametre: 'lancers', valeurs: [1, 2] }] },
      { simultanees: 1, surProgression: (faites, total) => progression.push([faites, total]) },
    );
    expect(progression).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
  });

  it.each([
    [[], { kind: 'nombre-d-axes', axes: 0 }],
    [
      [
        { parametre: 'lancers', valeurs: [1] },
        { parametre: 'lancers', valeurs: [2] },
        { parametre: 'lancers', valeurs: [3] },
      ],
      { kind: 'nombre-d-axes', axes: 3 },
    ],
    [[{ parametre: 'vitesse', valeurs: [1] }], { kind: 'parametre-inconnu', parametre: 'vitesse' }],
    [
      [
        { parametre: 'lancers', valeurs: [1] },
        { parametre: 'lancers', valeurs: [2] },
      ],
      { kind: 'parametre-en-double', parametre: 'lancers' },
    ],
    [[{ parametre: 'lancers', valeurs: [] }], { kind: 'axe-vide', parametre: 'lancers' }],
    [
      [{ parametre: 'lancers', valeurs: [3, 11] }],
      { kind: 'valeur-hors-definition', parametre: 'lancers', valeur: 11, raison: 'hors-bornes' },
    ],
  ])('refuse les axes %j', async (axes, probleme) => {
    expect(await lancerUnBalayage(scenario, { ...DEMANDE, axes })).toEqual({
      ok: false,
      error: probleme,
    });
  });

  it(`refuse plus de ${String(POINTS_MAXIMAUX_PAR_BALAYAGE)} points, et accepte la limite`, async () => {
    const definition = {
      ...DEFINITION_DE_TEST,
      parametres: [
        { kind: 'entier' as const, nom: 'x', min: 1, max: 100, defaut: 1 },
        { kind: 'entier' as const, nom: 'y', min: 1, max: 100, defaut: 1 },
        ...DEFINITION_DE_TEST.parametres,
      ],
    };
    const simulateur = new SimulateurScripte(
      () => ({ piles: 0, issue: 'pile', cumul: [] }),
      definition,
    );
    const de = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    const trop = await lancerUnBalayage(simulateur, {
      ...DEMANDE,
      iterations: 1,
      axes: [
        { parametre: 'x', valeurs: de(20) },
        { parametre: 'y', valeurs: de(21) },
      ],
    });
    expect(trop).toEqual({ ok: false, error: { kind: 'trop-de-points', points: 420 } });
    const juste = await lancerUnBalayage(simulateur, {
      ...DEMANDE,
      iterations: 1,
      axes: [
        { parametre: 'x', valeurs: de(20) },
        { parametre: 'y', valeurs: de(20) },
      ],
    });
    expect(juste.ok && juste.value.points).toHaveLength(POINTS_MAXIMAUX_PAR_BALAYAGE);
  });

  it('rapporte le premier point en échec avec ses valeurs', async () => {
    const fragile = new SimulateurScripte((valeurs) => {
      if (valeurs['lancers'] === 3) throw new Error('trois lancers interdits');
      return { piles: 0, issue: 'pile', cumul: [] };
    });
    const balayage = await lancerUnBalayage(fragile, {
      ...DEMANDE,
      axes: [{ parametre: 'lancers', valeurs: [2, 3, 4] }],
    });
    expect(!balayage.ok && balayage.error).toMatchObject({
      kind: 'point-en-echec',
      valeurs: [3],
      probleme: { kind: 'simulation-en-echec', message: 'trois lancers interdits' },
    });
    expect(fragile.appels.filter((a) => a.valeurs['lancers'] === 4)).toHaveLength(0);
  });

  it("s'arrête quand on l'annule", async () => {
    const annulation = new AbortController();
    const balayage = await lancerUnBalayage(
      scenario,
      { ...DEMANDE, axes: [{ parametre: 'lancers', valeurs: [1, 2, 3] }] },
      {
        signal: annulation.signal,
        surProgression: (faites) => {
          if (faites === 12) annulation.abort();
        },
      },
    );
    expect(balayage).toEqual({ ok: false, error: { kind: 'balayage-annule' } });
  });
});

describe('indicateurs', () => {
  async function unBalayage(): Promise<Balayage> {
    const balayage = await lancerUnBalayage(scenario, {
      ...DEMANDE,
      axes: [{ parametre: 'lancers', valeurs: [2, 8] }],
    });
    if (!balayage.ok) throw new Error(balayage.error.kind);
    return balayage.value;
  }

  it('donne la moyenne de chaque nombre et le taux de chaque catégorie, point par point', async () => {
    const balayage = await unBalayage();
    const indicateurs = indicateursDuBalayage(balayage);
    expect(indicateurs.map(({ id, libelle, taux }) => [id, libelle, taux])).toEqual([
      ['piles:moyenne', 'piles : moyenne', false],
      ['issue=pile', 'issue : taux de « pile »', true],
      ['issue=face', 'issue : taux de « face »', true],
    ]);
    const [piles, pile, face] = indicateurs;
    const premier = elementA(balayage.points, 0).resume.mesures[0];
    if (premier?.kind !== 'nombre' || premier.resume === null) throw new Error('piles');
    expect(piles?.valeurs[0]).toEqual({
      valeur: premier.resume.moyenne,
      ...intervalleDeLaMoyenne(premier.resume),
    });
    expect(pile?.valeurs.map((v) => v?.valeur)).toEqual([0, 1]);
    expect(face?.valeurs.map((v) => v?.valeur)).toEqual([1, 0]);
  });

  it("cite l'unité d'un nombre, et n'a pas de valeur là où le point n'en a pas", async () => {
    const balayage = await unBalayage();
    const [premier, second] = balayage.points;
    if (premier === undefined || second === undefined) throw new Error('points');
    const sansValeurs: Balayage = {
      ...balayage,
      definition: {
        ...balayage.definition,
        mesures: balayage.definition.mesures.map((m) =>
          m.kind === 'nombre' ? { ...m, libelle: 'Piles', unite: 'faces' } : m,
        ),
      },
      points: [
        premier,
        {
          ...second,
          resume: {
            ...second.resume,
            mesures: second.resume.mesures.map((m) => {
              if (m.kind === 'nombre') return { ...m, resume: null };
              if (m.kind === 'categorie') return { ...m, frequences: [] };
              return m;
            }),
          },
        },
      ],
    };
    const indicateurs = indicateursDuBalayage(sansValeurs);
    expect(indicateurs[0]?.libelle).toBe('Piles (faces) : moyenne');
    expect(indicateurs.map((i) => i.valeurs[1])).toEqual([null, null, null]);
  });
});
