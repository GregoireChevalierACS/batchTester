import { ecartDeMoyennes, ecartDeProportions, elementA } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import { comparerDeuxLots } from './comparerDeuxLots.ts';
import { lancerUnLot } from './lancerUnLot.ts';
import { resumerLeLot, type ResumeDeLot, type ResumeDeMesure } from './resumerLeLot.ts';
import { graine, resultatDeTest, SimulateurScripte } from './testing/index.ts';

async function unLot(n: number, lancers: number): Promise<ResumeDeLot> {
  const lot = await lancerUnLot(new SimulateurScripte(resultatDeTest), {
    surcharges: { lancers },
    graine: graine(n),
    iterations: 60,
  });
  if (!lot.ok) throw new Error(lot.error.kind);
  return resumerLeLot(lot.value);
}

const mesureDe = <K extends ResumeDeMesure['kind']>(resume: ResumeDeLot, kind: K) => {
  const trouvee = resume.mesures.find(
    (m): m is Extract<ResumeDeMesure, { kind: K }> => m.kind === kind,
  );
  if (trouvee === undefined) throw new Error(kind);
  return trouvee;
};

describe('comparer deux lots', () => {
  it('met côte à côte les réglages et signale ceux qui diffèrent', async () => {
    const comparaison = comparerDeuxLots(await unLot(1, 3), await unLot(2, 5));
    expect(comparaison.parametres).toEqual([{ nom: 'lancers', a: 3, b: 5, different: true }]);
    expect(comparerDeuxLots(await unLot(1, 3), await unLot(2, 3)).parametres).toEqual([
      { nom: 'lancers', a: 3, b: 3, different: false },
    ]);
  });

  it('donne, pour chaque mesure, les deux résumés et l’écart b − a avec son intervalle', async () => {
    const [a, b] = [await unLot(1, 3), await unLot(2, 3)];
    const { mesures, sansEquivalent, memeVersion } = comparerDeuxLots(a, b);
    expect(memeVersion).toBe(true);
    expect(sansEquivalent).toEqual([]);
    expect(mesures.map((m) => m.mesure.nom)).toEqual(['piles', 'issue', 'cumul']);

    const [nombreA, nombreB] = [mesureDe(a, 'nombre').resume, mesureDe(b, 'nombre').resume];
    if (nombreA === null || nombreB === null) throw new Error('résumés vides');
    expect(elementA(mesures, 0)).toEqual({
      kind: 'nombre',
      mesure: mesureDe(a, 'nombre').mesure,
      a: nombreA,
      b: nombreB,
      ecart: ecartDeMoyennes(nombreA, nombreB),
    });

    const [fa, fb] = [mesureDe(a, 'categorie').frequences, mesureDe(b, 'categorie').frequences];
    expect(elementA(mesures, 1)).toEqual({
      kind: 'categorie',
      mesure: mesureDe(a, 'categorie').mesure,
      categories: [0, 1].map((i) => ({
        categorie: elementA(fa, i).categorie,
        a: elementA(fa, i),
        b: elementA(fb, i),
        ecart: ecartDeProportions(elementA(fa, i), elementA(fb, i)),
      })),
    });

    expect(elementA(mesures, 2)).toEqual({
      kind: 'serie',
      mesure: mesureDe(a, 'serie').mesure,
      a: mesureDe(a, 'serie').points,
      b: mesureDe(b, 'serie').points,
    });
  });

  it('signale deux versions ou deux systèmes différents', async () => {
    const a = await unLot(1, 3);
    const autreVersion = { ...a, definition: { ...a.definition, version: '2.0.0' } };
    const autreSysteme = { ...a, definition: { ...a.definition, nom: 'Autre' } };
    expect(comparerDeuxLots(a, autreVersion).memeVersion).toBe(false);
    expect(comparerDeuxLots(a, autreSysteme).memeVersion).toBe(false);
  });

  it('compare ce qui existe des deux côtés quand la définition a changé', async () => {
    const a = await unLot(1, 3);
    const b = await unLot(2, 3);
    const categorie = mesureDe(b, 'categorie');
    const nombre = mesureDe(b, 'nombre');
    const modifie: ResumeDeLot = {
      ...b,
      definition: {
        ...b.definition,
        parametres: [
          ...b.definition.parametres,
          { kind: 'booleen', nom: 'bonus', libelle: 'Bonus', defaut: false },
        ],
      },
      valeurs: { ...b.valeurs, bonus: true },
      mesures: [
        // Mesure qui a changé de sorte : non comparée.
        { ...categorie, mesure: { ...categorie.mesure, nom: 'piles' } },
        // Catégorie ajoutée : présente d'un seul côté.
        { ...categorie, mesure: { ...categorie.mesure, categories: ['pile', 'face', 'tranche'] } },
        // Mesure ajoutée, absente de a.
        { ...nombre, mesure: { ...nombre.mesure, nom: 'duree' } },
      ],
    };
    const comparaison = comparerDeuxLots(a, modifie);
    expect(comparaison.parametres).toContainEqual({
      nom: 'bonus',
      libelle: 'Bonus',
      a: undefined,
      b: true,
      different: true,
    });
    expect(comparaison.mesures.map((m) => m.mesure.nom)).toEqual(['issue']);
    expect(comparaison.sansEquivalent).toEqual(['piles', 'cumul', 'duree']);
    const issue = elementA(comparaison.mesures, 0);
    expect(issue.kind === 'categorie' && issue.categories.at(-1)).toEqual({
      categorie: 'tranche',
      a: null,
      b: null,
      ecart: null,
    });
  });

  it("n'a pas d'écart de moyennes quand un des lots n'a aucune valeur", async () => {
    const a = await unLot(1, 3);
    const nombre = mesureDe(a, 'nombre');
    const vide: ResumeDeLot = { ...a, mesures: [{ ...nombre, resume: null }] };
    const [comparee] = comparerDeuxLots(a, vide).mesures;
    expect(comparee).toMatchObject({ kind: 'nombre', b: null, ecart: null });
  });
});
