import { describe, expect, it } from 'vitest';
import { messageDErreur } from './messageDErreur.ts';

describe("message d'une exception", () => {
  it("prend le message d'une Error", () => {
    expect(messageDErreur(new TypeError('option inconnue'))).toBe('option inconnue');
  });

  it("affiche telle quelle une valeur qui n'est pas une Error", () => {
    expect(messageDErreur('boum')).toBe('boum');
    expect(messageDErreur(42)).toBe('42');
  });
});
