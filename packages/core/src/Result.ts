// Une erreur métier est un résultat attendu, pas un accident : elle apparaît dans la signature et
// l'appelant est obligé de la traiter. Les exceptions restent réservées aux vraies pannes.
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
