import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { aLaFormeDUnSysteme, chargerUnSysteme } from './chargerUnSysteme.ts';

describe("forme d'un système", () => {
  const definition = { nom: 'S', version: '1', parametres: [], mesures: [] };
  const simuler = () => ({});

  it('reconnaît un système', () => {
    expect(aLaFormeDUnSysteme({ definition, simuler })).toBe(true);
  });

  it.each([
    ['rien', undefined],
    ['null', null],
    ['un nombre', 42],
    ['sans simuler', { definition }],
    ['simuler qui n’est pas une fonction', { definition, simuler: 'joue' }],
    ['sans définition', { simuler }],
    ['une définition null', { definition: null, simuler }],
    ['une définition sans nom', { definition: { ...definition, nom: undefined }, simuler }],
    ['une version qui n’est pas un texte', { definition: { ...definition, version: 1 }, simuler }],
    [
      'des paramètres qui ne sont pas une liste',
      { definition: { ...definition, parametres: {} }, simuler },
    ],
    ['sans mesures', { definition: { nom: 'S', version: '1', parametres: [] }, simuler }],
  ])('refuse %s', (_cas, candidat) => {
    expect(aLaFormeDUnSysteme(candidat)).toBe(false);
  });
});

const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));

describe('charger un système', () => {
  it("charge l'export par défaut d'un module, relatif au répertoire donné", async () => {
    const charge = await chargerUnSysteme('systemes/combat/src/index.ts', RACINE);
    expect(charge.ok && charge.value.definition.nom).toBe('Combat 1 contre 1');
  });

  it('signale un module introuvable ou qui échoue au chargement', async () => {
    const absent = await chargerUnSysteme('absent.ts', FIXTURES);
    expect(absent).toMatchObject({
      ok: false,
      error: { kind: 'module-introuvable', chemin: 'absent.ts' },
    });
    expect(await chargerUnSysteme('importEnEchec.ts', FIXTURES)).toEqual({
      ok: false,
      error: {
        kind: 'module-introuvable',
        chemin: 'importEnEchec.ts',
        message: 'initialisation impossible',
      },
    });
  });

  it.each(['sansExportParDefaut.ts', 'pasUnSysteme.ts'])(
    "signale un export qui n'est pas un système (%s)",
    async (chemin) => {
      expect(await chargerUnSysteme(chemin, FIXTURES)).toEqual({
        ok: false,
        error: { kind: 'export-invalide', chemin },
      });
    },
  );

  it('laisse au runner le détail de la définition', async () => {
    const charge = await chargerUnSysteme('definitionInvalide.ts', FIXTURES);
    expect(charge.ok && charge.value.definition.version).toBe('');
  });
});
