import { describe, expect, it } from 'vitest';
import { AIDE, GRAINE_PAR_DEFAUT, ITERATIONS_PAR_DEFAUT, lireLesArguments } from './arguments.ts';

describe('lire les arguments', () => {
  it('prend les valeurs par défaut avec le seul chemin du système', () => {
    expect(lireLesArguments(['systeme.ts'])).toEqual({
      ok: true,
      value: {
        kind: 'lancer',
        chemin: 'systeme.ts',
        iterations: ITERATIONS_PAR_DEFAUT,
        graine: GRAINE_PAR_DEFAUT,
        parametres: [],
        simultanees: null,
        json: false,
      },
    });
    expect([ITERATIONS_PAR_DEFAUT, GRAINE_PAR_DEFAUT]).toEqual([100, 1]);
  });

  it('lit chaque option, en forme courte et longue', () => {
    const courtes = lireLesArguments([
      's.ts',
      '-n',
      '500',
      '-g',
      '42',
      '-p',
      'pvA=120',
      '-p',
      ' precision = 0,9 ',
    ]);
    const longues = lireLesArguments([
      '--iterations=500',
      '--graine',
      '42',
      '--param',
      'pvA=120',
      '--param=precision=0,9',
      '--simultanees',
      '4',
      '--json',
      's.ts',
    ]);
    const attendu = {
      kind: 'lancer',
      chemin: 's.ts',
      iterations: 500,
      graine: 42,
      parametres: [
        ['pvA', '120'],
        ['precision', '0,9'],
      ],
    };
    expect(courtes).toEqual({ ok: true, value: { ...attendu, simultanees: null, json: false } });
    expect(longues).toEqual({ ok: true, value: { ...attendu, simultanees: 4, json: true } });
  });

  it('garde le texte après le premier = comme valeur', () => {
    const lus = lireLesArguments(['s.ts', '-p', 'formule=a=b']);
    expect(lus.ok && lus.value.kind === 'lancer' && lus.value.parametres).toEqual([
      ['formule', 'a=b'],
    ]);
  });

  it.each([['-h'], ['--aide'], ['s.ts', '--aide']])("demande l'aide avec %j", (...argv) => {
    expect(lireLesArguments(argv)).toEqual({ ok: true, value: { kind: 'aide' } });
  });

  it("documente chaque option dans l'aide", () => {
    for (const option of [
      '--iterations',
      '--graine',
      '--param',
      '--simultanees',
      '--json',
      '--aide',
    ]) {
      expect(AIDE).toContain(option);
    }
  });

  it('exige un et un seul système', () => {
    expect(lireLesArguments([])).toEqual({ ok: false, error: { kind: 'systeme-absent' } });
    expect(lireLesArguments(['a.ts', 'b.ts'])).toEqual({
      ok: false,
      error: { kind: 'trop-de-systemes', chemins: ['a.ts', 'b.ts'] },
    });
  });

  it('refuse une option inconnue ou sans valeur', () => {
    const inconnue = lireLesArguments(['s.ts', '--vitesse']);
    expect(!inconnue.ok && inconnue.error.kind).toBe('arguments-invalides');
    expect(
      !inconnue.ok && inconnue.error.kind === 'arguments-invalides' && inconnue.error.message,
    ).toContain('--vitesse');
    const sansValeur = lireLesArguments(['s.ts', '-n']);
    expect(!sansValeur.ok && sansValeur.error.kind).toBe('arguments-invalides');
  });

  it.each([
    ['-n', 'beaucoup', '--iterations'],
    ['-n', '2.5', '--iterations'],
    ['-g', '0x2A', '--graine'],
    ['--simultanees', 'deux', '--simultanees'],
  ])('refuse %s %s', (option, texte, nom) => {
    expect(lireLesArguments(['s.ts', option, texte])).toEqual({
      ok: false,
      error: { kind: 'entier-illisible', option: nom, texte },
    });
  });

  it('refuse un nombre négatif', () => {
    expect(lireLesArguments(['s.ts', '--iterations=-5'])).toEqual({
      ok: false,
      error: { kind: 'entier-illisible', option: '--iterations', texte: '-5' },
    });
  });

  it('refuse une graine au-delà de 32 bits', () => {
    expect(lireLesArguments(['s.ts', '-g', '4294967296'])).toEqual({
      ok: false,
      error: { kind: 'graine-hors-limites', texte: '4294967296' },
    });
    expect(lireLesArguments(['s.ts', '-g', '4294967295']).ok).toBe(true);
  });

  it.each(['pvA', '=120', 'pvA:120'])('refuse le paramètre « %s »', (texte) => {
    expect(lireLesArguments(['s.ts', '-p', 'ok=1', '-p', texte])).toEqual({
      ok: false,
      error: { kind: 'parametre-illisible', texte },
    });
  });
});
