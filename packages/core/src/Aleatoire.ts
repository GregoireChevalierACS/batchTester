import { brasser, type Graine } from './Graine.ts';
import { elementA } from './Indexation.ts';

/** Seule source de hasard d'une simulation : la même graine rejoue exactement la même suite. */
export interface Aleatoire {
  /** Réel dans [0, 1[. */
  reel(): number;
  /** Entier dans [min, max], bornes comprises. */
  entier(min: number, max: number): number;
  /** Vrai avec la probabilité p : jamais si p ≤ 0, toujours si p ≥ 1. */
  chance(p: number): boolean;
  /** Un élément tiré uniformément. */
  choisir<T>(elements: readonly [T, ...T[]]): T;
  /** Une copie mélangée uniformément ; le tableau reçu n'est pas modifié. */
  melanger<T>(elements: readonly T[]): T[];
}

// Les simulations d'un lot tirent des milliers de nombres chacune : sfc32 (état de 128 bits,
// rapide, bonnes propriétés statistiques) plutôt qu'un générateur à 32 bits d'état.
const TIRAGES_DE_CHAUFFE = 12;

export function creerAleatoire(graine: Graine): Aleatoire {
  let a = brasser(graine);
  let b = brasser(a);
  let c = brasser(b);
  let d = 1;

  const suivant32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  // Les premiers tirages de sfc32 dépendent encore beaucoup de l'état initial : on les écarte.
  for (let i = 0; i < TIRAGES_DE_CHAUFFE; i += 1) suivant32();

  const reel = (): number => suivant32() / 2 ** 32;

  const entier = (min: number, max: number): number => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError(
        `entier(${String(min)}, ${String(max)}) : bornes entières attendues, min ≤ max`,
      );
    }
    return min + Math.floor(reel() * (max - min + 1));
  };

  return {
    reel,
    entier,
    // Stryker disable next-line EqualityOperator: reel() ne vaut p exactement qu'une fois sur 2^32, < et ≤ sont indiscernables
    chance: (p) => reel() < p,
    choisir: (elements) => elementA(elements, entier(0, elements.length - 1)),
    // Tri par clé aléatoire : uniforme (les égalités de clés sont négligeables sur 32 bits) et
    // sans échange d'éléments par index.
    melanger: (elements) =>
      elements
        .map((element) => ({ element, cle: reel() }))
        .sort((x, y) => x.cle - y.cle)
        .map(({ element }) => element),
  };
}
