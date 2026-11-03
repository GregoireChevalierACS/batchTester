import { describe, expect, it } from 'vitest';
import { verifierLaDefinition, type DefinitionDeSysteme } from './Systeme.ts';

const DEFINITION: DefinitionDeSysteme = {
  nom: 'Duel',
  version: '1.0.0',
  parametres: [
    { kind: 'entier', nom: 'pv', min: 1, max: 100, defaut: 10 },
    { kind: 'booleen', nom: 'bouclier', defaut: false },
  ],
  mesures: [
    { kind: 'nombre', nom: 'tours' },
    { kind: 'categorie', nom: 'vainqueur', categories: ['A', 'B'] },
  ],
};

describe('verifierLaDefinition', () => {
  it('accepte une définition correcte', () => {
    expect(verifierLaDefinition(DEFINITION)).toEqual([]);
  });

  it('accepte un paramètre et une mesure du même nom', () => {
    const definition: DefinitionDeSysteme = {
      ...DEFINITION,
      mesures: [{ kind: 'nombre', nom: 'pv' }],
    };
    expect(verifierLaDefinition(definition)).toEqual([]);
  });

  it.each(['', '  '])('signale un nom de système ou une version vide (%j)', (vide) => {
    expect(verifierLaDefinition({ ...DEFINITION, nom: vide })).toEqual([
      { kind: 'nom-de-systeme-vide' },
    ]);
    expect(verifierLaDefinition({ ...DEFINITION, version: vide })).toEqual([
      { kind: 'version-vide' },
    ]);
  });

  it('signale les noms vides et en double, section par section', () => {
    const definition: DefinitionDeSysteme = {
      ...DEFINITION,
      parametres: [
        { kind: 'booleen', nom: ' ', defaut: true },
        { kind: 'booleen', nom: 'x', defaut: true },
        { kind: 'booleen', nom: 'x', defaut: true },
      ],
      mesures: [
        { kind: 'nombre', nom: 'y' },
        { kind: 'nombre', nom: '' },
        { kind: 'nombre', nom: 'y' },
      ],
    };
    expect(verifierLaDefinition(definition)).toEqual([
      { kind: 'nom-vide', section: 'parametre' },
      { kind: 'nom-en-double', section: 'parametre', nom: 'x' },
      { kind: 'nom-vide', section: 'mesure' },
      { kind: 'nom-en-double', section: 'mesure', nom: 'y' },
    ]);
  });

  it('rassemble les défauts des paramètres et des mesures', () => {
    const definition: DefinitionDeSysteme = {
      ...DEFINITION,
      parametres: [{ kind: 'entier', nom: 'pv', min: 10, max: 1, defaut: 5 }],
      mesures: [{ kind: 'categorie', nom: 'vainqueur', categories: [] }],
    };
    expect(verifierLaDefinition(definition)).toEqual([
      { kind: 'bornes-invalides', nom: 'pv' },
      { kind: 'categories-invalides', nom: 'vainqueur' },
    ]);
  });
});
