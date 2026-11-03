import { describe, expect, it } from 'vitest';
import { verifierLeResultat, verifierUneMesure, type DefMesure } from './Mesures.ts';

const MESURES: readonly DefMesure[] = [
  { kind: 'nombre', nom: 'tours', unite: 'tours' },
  { kind: 'categorie', nom: 'vainqueur', categories: ['A', 'B', 'nul'] },
  { kind: 'serie', nom: 'pvA' },
];

describe('verifierUneMesure', () => {
  it.each(MESURES)('accepte $nom', (def) => {
    expect(verifierUneMesure(def)).toEqual([]);
  });

  it.each([[[]], [['A', 'A']]])('signale les catégories %j', (categories) => {
    expect(verifierUneMesure({ kind: 'categorie', nom: 'vainqueur', categories })).toEqual([
      { kind: 'categories-invalides', nom: 'vainqueur' },
    ]);
  });
});

describe('verifierLeResultat', () => {
  it('accepte un résultat conforme', () => {
    const brut = { tours: 7, vainqueur: 'A', pvA: [100, 80.5, 42] };
    expect(verifierLeResultat(MESURES, brut)).toEqual({ ok: true, value: brut });
  });

  it('accepte une série vide', () => {
    expect(verifierLeResultat(MESURES, { tours: 0, vainqueur: 'nul', pvA: [] }).ok).toBe(true);
  });

  it.each([null, 3, 'texte', [1, 2], undefined])('refuse %j, qui n’est pas un objet', (brut) => {
    expect(verifierLeResultat(MESURES, brut)).toEqual({
      ok: false,
      error: [{ kind: 'pas-un-objet' }],
    });
  });

  it('rapporte toutes les erreurs à la fois', () => {
    expect(verifierLeResultat(MESURES, { vainqueur: 'C', pvA: [1], duree: 3 })).toEqual({
      ok: false,
      error: [
        { kind: 'mesure-inattendue', nom: 'duree' },
        { kind: 'mesure-manquante', nom: 'tours' },
        { kind: 'categorie-inconnue', nom: 'vainqueur', valeur: 'C' },
      ],
    });
  });

  it.each([
    ['tours', '7'],
    ['tours', Number.NaN],
    ['tours', Number.POSITIVE_INFINITY],
    ['vainqueur', 1],
    ['pvA', 'A'],
    ['pvA', [1, '2']],
    ['pvA', [1, Number.NaN]],
  ])('refuse %s = %j', (nom, valeur) => {
    const brut = { tours: 7, vainqueur: 'A', pvA: [1], [nom]: valeur };
    expect(verifierLeResultat(MESURES, brut)).toEqual({
      ok: false,
      error: [{ kind: 'type-incorrect', nom }],
    });
  });

  it('refuse une mesure présente mais undefined', () => {
    expect(verifierLeResultat(MESURES, { tours: undefined, vainqueur: 'A', pvA: [] })).toEqual({
      ok: false,
      error: [{ kind: 'type-incorrect', nom: 'tours' }],
    });
  });
});
