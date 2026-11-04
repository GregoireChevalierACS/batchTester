import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RESUME_DE_TEST, verifierLeContratDeLHistorique } from '@batchtester/runner/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ouvrirLHistorique } from './historiqueSqlite.ts';

verifierLeContratDeLHistorique('SQLite en mémoire', () => ouvrirLHistorique(':memory:'));

describe('historique SQLite', () => {
  let dossier = '';
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'batchtester-historique-'));
  });
  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  it("garde les lancements d'une ouverture à l'autre", () => {
    const chemin = join(dossier, 'historique.sqlite');
    const premiere = ouvrirLHistorique(chemin, () => new Date('2026-11-04T09:30:00Z'));
    const { id } = premiere.enregistrer({ systeme: 'pile', nom: 'gardé', resume: RESUME_DE_TEST });
    premiere.fermer();

    const seconde = ouvrirLHistorique(chemin);
    expect(seconde.lire(id)).toEqual({
      id,
      date: '2026-11-04T09:30:00.000Z',
      systeme: 'pile',
      nom: 'gardé',
      resume: RESUME_DE_TEST,
    });
    seconde.fermer();
  });

  it('signale une base abîmée au lieu de rendre des données fausses', () => {
    const chemin = join(dossier, 'abimee.sqlite');
    const historique = ouvrirLHistorique(chemin);
    try {
      const { id } = historique.enregistrer({ systeme: 'pile', nom: 'x', resume: RESUME_DE_TEST });
      const base = new DatabaseSync(chemin);
      base
        .prepare("update lancements set resume = '42', apercu = '\"texte\"' where id = ?")
        .run(id);
      expect(() => historique.lire(id)).toThrow('historique abîmé : colonne « resume » illisible');
      expect(() => historique.lister()).toThrow('historique abîmé : colonne « apercu » illisible');
      // Une date binaire : la colonne texte ne la convertit pas.
      base.exec(
        "insert into lancements (date, systeme, nom, apercu, resume) values (X'00', 'pile', 'y', '{}', '{}')",
      );
      base.close();
      expect(() => historique.lister()).toThrow('historique abîmé : colonne « date » illisible');
    } finally {
      historique.fermer();
    }
  });
});
