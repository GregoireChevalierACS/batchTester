import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decouvrirLesSystemes, POINT_D_ENTREE } from './decouvrirLesSystemes.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/systemes', import.meta.url));
const SYSTEMES_DU_DEPOT = fileURLToPath(new URL('../../../systemes', import.meta.url));

describe('découvrir les systèmes', () => {
  it("charge chaque dossier qui a un point d'entrée, et rapporte ceux qui échouent", async () => {
    const { systemes, problemes } = await decouvrirLesSystemes(FIXTURES);
    expect(systemes.map(({ id, systeme }) => [id, systeme.definition.nom])).toEqual([
      ['bon', 'Bon'],
    ]);
    expect(problemes).toEqual([{ kind: 'export-invalide', chemin: join('casse', POINT_D_ENTREE) }]);
  });

  it('trouve le système de combat du dépôt', async () => {
    const { systemes, problemes } = await decouvrirLesSystemes(SYSTEMES_DU_DEPOT);
    expect(systemes.map(({ id }) => id)).toContain('combat');
    expect(problemes).toEqual([]);
  });

  it('échoue si le répertoire lui-même est introuvable', async () => {
    await expect(decouvrirLesSystemes(join(FIXTURES, 'absent'))).rejects.toThrow();
  });
});
