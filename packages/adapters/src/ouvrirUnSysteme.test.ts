import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerUnLot } from '@batchtester/runner';
import { graine } from '@batchtester/runner/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  expliquerUnProblemeDOuverture,
  MANIFESTE,
  ouvrirUnSysteme,
  type ProblemeDOuverture,
} from './ouvrirUnSysteme.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const PROGRAMME = join(FIXTURES, 'externes', 'programme.mjs');

describe('ouvrir un système', () => {
  let dossier = '';
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'batchtester-manifeste-'));
  });
  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  const manifeste = async (contenu: string) => {
    await writeFile(join(dossier, MANIFESTE), contenu);
    return ouvrirUnSysteme(MANIFESTE, dossier);
  };

  it('ouvre un système TypeScript, qui se ferme sans rien faire', async () => {
    const ouvert = await ouvrirUnSysteme(join('systemes', 'bon', 'src', 'index.ts'), FIXTURES);
    if (!ouvert.ok) throw new Error(ouvert.error.kind);
    expect(ouvert.value.definition.nom).toBe('Bon');
    const lot = await lancerUnLot(ouvert.value.simulateur, {
      surcharges: {},
      graine: graine(1),
      iterations: 5,
    });
    expect(lot.ok).toBe(true);
    await expect(ouvert.value.fermer()).resolves.toBeUndefined();
  });

  it('rapporte un module TypeScript qui ne se charge pas', async () => {
    expect(await ouvrirUnSysteme('pasUnSysteme.ts', FIXTURES)).toEqual({
      ok: false,
      error: { kind: 'export-invalide', chemin: 'pasUnSysteme.ts' },
    });
  });

  it('lance le programme du manifeste dans le dossier du manifeste, et le ferme', async () => {
    const ouvert = await manifeste(
      JSON.stringify({ commande: process.execPath, arguments: [PROGRAMME] }),
    );
    if (!ouvert.ok) throw new Error(expliquerUnProblemeDOuverture(ouvert.error));
    expect(ouvert.value.definition.nom).toBe('Pile ou face externe');
    expect(await ouvert.value.simulateur.simuler({ lancers: 4 }, graine(42))).toEqual({
      piles: 1,
      issue: 'face',
      cumul: [0, 1, 1, 1],
    });
    await ouvert.value.fermer();
    await expect(ouvert.value.simulateur.simuler({ lancers: 1 }, graine(1))).rejects.toThrow();
  });

  it('accepte un manifeste sans arguments', async () => {
    const ouvert = await manifeste(JSON.stringify({ commande: 'commande-qui-n-existe-pas' }));
    expect(!ouvert.ok && ouvert.error.kind).toBe('lancement-impossible');
  });

  it.each([
    ['{pas du json', /^Expected property name|^Unexpected token/u],
    ['42', /^un objet JSON est attendu$/u],
    ['null', /^un objet JSON est attendu$/u],
    ['{}', /^« commande » doit être un texte non vide$/u],
    ['{"commande": "  "}', /^« commande » doit être un texte non vide$/u],
    ['{"commande": "node", "arguments": "a.py"}', /^« arguments » doit être une liste de textes$/u],
  ])('refuse le manifeste %s', async (contenu, message) => {
    const ouvert = await manifeste(contenu);
    expect(!ouvert.ok && ouvert.error).toMatchObject({
      kind: 'manifeste-illisible',
      chemin: MANIFESTE,
    });
    expect(
      !ouvert.ok && ouvert.error.kind === 'manifeste-illisible' && ouvert.error.message,
    ).toMatch(message);
  });

  it('refuse un manifeste absent', async () => {
    const ouvert = await ouvrirUnSysteme(MANIFESTE, dossier);
    expect(!ouvert.ok && ouvert.error).toMatchObject({
      kind: 'manifeste-illisible',
      chemin: MANIFESTE,
    });
  });
});

describe('expliquer un problème d’ouverture', () => {
  it.each<[ProblemeDOuverture, string]>([
    [
      { kind: 'module-introuvable', chemin: 'x.ts', message: 'absent' },
      'Impossible de charger « x.ts » : absent',
    ],
    [
      { kind: 'export-invalide', chemin: 'x.ts' },
      "« x.ts » n'exporte pas de système par défaut (definition et simuler).",
    ],
    [
      { kind: 'lancement-impossible', commande: 'python', message: 'ENOENT' },
      'Impossible de lancer « python » : ENOENT',
    ],
    [
      { kind: 'definition-absente', commande: 'python', message: 'code 1' },
      "« python » n'a pas annoncé sa définition : code 1",
    ],
    [
      { kind: 'definition-illisible', commande: 'python', ligne: 'bonjour' },
      '« python » a annoncé une définition illisible : bonjour',
    ],
    [
      {
        kind: 'manifeste-illisible',
        chemin: 'des/systeme.json',
        message: 'un objet JSON est attendu',
      },
      '« des/systeme.json » illisible : un objet JSON est attendu',
    ],
  ])('%j', (probleme, message) => {
    expect(expliquerUnProblemeDOuverture(probleme)).toBe(message);
  });
});
