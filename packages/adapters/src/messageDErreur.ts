/** Texte à afficher pour une exception : son message si c'est une Error, sinon la valeur levée. */
export const messageDErreur = (erreur: unknown): string =>
  erreur instanceof Error ? erreur.message : String(erreur);
