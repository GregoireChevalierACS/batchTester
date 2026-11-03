import type { DefParametre } from '@batchtester/core';

const NOMBRE = /^-?\d+(?:[.,]\d+)?$/;

/**
 * Convertit le texte saisi selon la sorte du paramètre : « 0,5 » ou « 0.5 » pour un nombre,
 * « oui » ou « true » pour un booléen. Un texte qui ne se convertit pas est transmis tel quel :
 * la vérification des valeurs le refusera avec un message qui le cite.
 */
export function interpreterUnTexte(def: DefParametre | undefined, texte: string): unknown {
  switch (def?.kind) {
    case 'nombre':
    case 'entier':
      return NOMBRE.test(texte) ? Number(texte.replace(',', '.')) : texte;
    case 'booleen':
      if (texte === 'oui' || texte === 'true') return true;
      if (texte === 'non' || texte === 'false') return false;
      return texte;
    case 'choix':
    case undefined:
      return texte;
  }
}

export function interpreterLesParametres(
  defs: readonly DefParametre[],
  paires: readonly (readonly [string, string])[],
): Record<string, unknown> {
  const parNom = new Map(defs.map((def) => [def.nom, def]));
  return Object.fromEntries(
    paires.map(([nom, texte]) => [nom, interpreterUnTexte(parNom.get(nom), texte)]),
  );
}
