import { describe, expect, it } from 'vitest';
import { elementA } from './Indexation.ts';

describe('elementA', () => {
  it("renvoie l'élément à l'index demandé", () => {
    expect(elementA(['a', 'b', 'c'], 0)).toBe('a');
    expect(elementA(['a', 'b', 'c'], 2)).toBe('c');
  });

  it('renvoie un élément null présent dans le tableau', () => {
    expect(elementA([null], 0)).toBeNull();
  });

  it.each([-1, 3, 1.5, Number.NaN])("refuse l'index %d", (index) => {
    expect(() => elementA(['a', 'b', 'c'], index)).toThrow(
      new RangeError(`index ${String(index)} hors du tableau (longueur 3)`),
    );
  });
});
