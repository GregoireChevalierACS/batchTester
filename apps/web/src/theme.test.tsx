/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { preferences } from './testing/preparation.ts';
import { CLAIR, COULEURS_DE_SERIE, SOMBRE, useTheme } from './theme.ts';

describe('thème', () => {
  it('suit la préférence du système, en direct', () => {
    const { result, unmount } = renderHook(() => useTheme());
    expect(result.current).toBe(CLAIR);
    act(() => {
      preferences.sombre = true;
      for (const prevenir of preferences.abonnes) prevenir();
    });
    expect(result.current).toBe(SOMBRE);
    unmount();
    expect(preferences.abonnes.size).toBe(0);
  });

  it('a autant de couleurs, dans le même ordre de teintes, en clair et en sombre', () => {
    expect(CLAIR.series).toHaveLength(COULEURS_DE_SERIE);
    expect(SOMBRE.series).toHaveLength(COULEURS_DE_SERIE);
  });
});
