import { describe, expect, it } from 'vitest';
import { apercuDe, nomParDefaut } from './historique.ts';
import {
  HistoriqueEnMemoire,
  RESUME_DE_TEST,
  verifierLeContratDeLHistorique,
} from './testing/index.ts';

verifierLeContratDeLHistorique('doublure en mémoire', () => new HistoriqueEnMemoire());

describe('historique', () => {
  it('résume un lancement pour la liste', () => {
    expect(
      apercuDe({
        id: 3,
        date: '2026-11-04T10:00:00.000Z',
        systeme: 'pile',
        nom: 'n',
        resume: RESUME_DE_TEST,
      }),
    ).toEqual({
      id: 3,
      date: '2026-11-04T10:00:00.000Z',
      systeme: 'pile',
      nom: 'n',
      nomDuSysteme: 'Pile ou face',
      version: '1.0.0',
      graine: 42,
      iterations: 2,
      valeurs: { lancers: 3 },
    });
  });

  it('propose un nom qui cite la graine et chaque réglage', () => {
    expect(nomParDefaut(RESUME_DE_TEST)).toBe('graine 42 · lancers=3');
  });

  it('date chaque enregistrement de la doublure une seconde après le précédent', () => {
    const historique = new HistoriqueEnMemoire();
    const dates = Array.from(
      { length: 61 },
      () => historique.enregistrer({ systeme: 'pile', nom: 'x', resume: RESUME_DE_TEST }).date,
    );
    expect(dates.slice(0, 2)).toEqual(['2026-11-04T10:00:01.000Z', '2026-11-04T10:00:02.000Z']);
    expect(dates.at(-1)).toBe('2026-11-04T10:01:01.000Z');
  });
});
