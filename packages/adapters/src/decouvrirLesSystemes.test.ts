import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decouvrirLesSystemes, POINT_D_ENTREE } from './decouvrirLesSystemes.ts';
import { MANIFESTE } from './ouvrirUnSysteme.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/systemes', import.meta.url));
const SYSTEMES_DU_DEPOT = fileURLToPath(new URL('../../../systemes', import.meta.url));

describe('découvrir les systèmes', () => {
  it('ouvre les systèmes TypeScript et externes, et rapporte ceux qui ne démarrent pas', async () => {
    const { systemes, problemes } = await decouvrirLesSystemes(FIXTURES);
    try {
      expect(systemes.map(({ id, definition }) => [id, definition.nom])).toEqual([
        ['bon', 'Bon'],
        ['externe', 'Pile ou face externe'],
      ]);
      expect(problemes).toEqual([
        { kind: 'export-invalide', chemin: join('casse', POINT_D_ENTREE) },
        {
          kind: 'manifeste-illisible',
          chemin: join('manifesteCasse', MANIFESTE),
          message: '« arguments » doit être une liste de textes',
        },
      ]);
    } finally {
      await Promise.all(systemes.map((s) => s.fermer()));
    }
  });

  it('trouve le système de combat du dépôt', async () => {
    const { systemes, problemes } = await decouvrirLesSystemes(SYSTEMES_DU_DEPOT);
    try {
      expect(systemes.map(({ id }) => id)).toContain('combat');
      expect(problemes).toEqual([]);
    } finally {
      await Promise.all(systemes.map((s) => s.fermer()));
    }
  });

  it('échoue si le répertoire lui-même est introuvable', async () => {
    await expect(decouvrirLesSystemes(join(FIXTURES, 'absent'))).rejects.toThrow();
  });
});
