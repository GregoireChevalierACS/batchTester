import { err, ok, type Result } from './Result.ts';

declare const marque: unique symbol;

/** Graine d'un générateur pseudo-aléatoire : entier non signé sur 32 bits. */
export type Graine = number & { readonly [marque]: 'Graine' };

export interface ErreurDeGraine {
  readonly kind: 'graine-invalide';
}

export const GRAINE_MAXIMALE = 0xffff_ffff;

const estUneGraine = (n: number): n is Graine =>
  Number.isInteger(n) && n >= 0 && n <= GRAINE_MAXIMALE;

export function creerGraine(n: number): Result<Graine, ErreurDeGraine> {
  return estUneGraine(n) ? ok(n) : err({ kind: 'graine-invalide' });
}

/**
 * Brasse 32 bits (finaliseur de splitmix32) : deux entrées voisines donnent des sorties sans
 * rapport entre elles. Renvoie un entier de 0 à 2^32 - 1.
 */
export function brasser(x: number): number {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/**
 * Graine de l'itération `index` d'un lot. Elle ne dépend que de la graine maître et de l'index,
 * jamais de l'ordre d'exécution : un lot lancé en parallèle reste reproductible, et une itération
 * en échec se rejoue seule.
 */
export function deriverLaGraine(maitre: Graine, index: number): Graine {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- brasser renvoie toujours un entier de 0 à 2^32 - 1
  return brasser(brasser(maitre) ^ index) as Graine;
}
