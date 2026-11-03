import type { DefParametre } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import { interpreterLesParametres, interpreterUnTexte } from './interpreterLesParametres.ts';

const NOMBRE: DefParametre = {
  kind: 'nombre',
  nom: 'precision',
  min: 0,
  max: 1,
  pas: 0.01,
  defaut: 0.5,
};
const ENTIER: DefParametre = { kind: 'entier', nom: 'pv', min: -10, max: 10, defaut: 0 };
const BOOLEEN: DefParametre = { kind: 'booleen', nom: 'bouclier', defaut: false };
const CHOIX: DefParametre = {
  kind: 'choix',
  nom: 'classe',
  options: ['1', 'mage'],
  defaut: 'mage',
};

describe('interpréter un texte', () => {
  it.each([
    [NOMBRE, '0.25', 0.25],
    [NOMBRE, '0,25', 0.25],
    [ENTIER, '-3', -3],
    [ENTIER, '7', 7],
    [NOMBRE, 'beaucoup', 'beaucoup'],
    [NOMBRE, '1e3', '1e3'],
    [NOMBRE, '', ''],
    [NOMBRE, '1,', '1,'],
    [BOOLEEN, 'oui', true],
    [BOOLEEN, 'true', true],
    [BOOLEEN, 'non', false],
    [BOOLEEN, 'false', false],
    [BOOLEEN, 'peut-être', 'peut-être'],
    [CHOIX, '1', '1'],
    [undefined, '12', '12'],
  ])('%o lit « %s » comme %j', (def, texte, attendu) => {
    expect(interpreterUnTexte(def, texte)).toEqual(attendu);
  });
});

describe('interpréter les paramètres', () => {
  it('interprète chaque paire selon le paramètre du même nom', () => {
    expect(
      interpreterLesParametres(
        [NOMBRE, BOOLEEN, CHOIX],
        [
          ['precision', '0,9'],
          ['bouclier', 'oui'],
          ['classe', '1'],
          ['inconnu', '3'],
        ],
      ),
    ).toEqual({ precision: 0.9, bouclier: true, classe: '1', inconnu: '3' });
  });
});
