/**
 * Élément d'un tableau à un index que l'appelant sait valide. Avec noUncheckedIndexedAccess,
 * `tableau[i]` est typé `T | undefined` : cette fonction rend la garantie explicite et échoue
 * bruyamment si elle est fausse, au lieu de propager un `undefined` dans un calcul.
 */
export function elementA<T>(tableau: readonly T[], index: number): T {
  if (!Number.isInteger(index) || index < 0 || index >= tableau.length) {
    throw new RangeError(
      `index ${String(index)} hors du tableau (longueur ${String(tableau.length)})`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- l'index vient d'être vérifié dans les bornes
  return tableau[index] as T;
}
