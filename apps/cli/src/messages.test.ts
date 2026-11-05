import { expliquerUnProblemeDeLot, type ProblemeDeLot } from '@batchtester/runner';
import { graine } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import { expliquer, type Probleme } from './messages.ts';

describe('expliquer un problème', () => {
  it.each<[Probleme, string]>([
    [
      { kind: 'arguments-invalides', message: "Unknown option '--x'" },
      "Arguments invalides : Unknown option '--x'",
    ],
    [{ kind: 'systeme-absent' }, 'Indiquer le chemin du système à simuler.'],
    [
      { kind: 'trop-de-systemes', chemins: ['a.ts', 'b.ts'] },
      'Un seul système à la fois (reçu : a.ts, b.ts).',
    ],
    [
      { kind: 'entier-illisible', option: '--iterations', texte: 'x' },
      '--iterations attend un entier positif (reçu : « x »).',
    ],
    [
      { kind: 'graine-hors-limites', texte: '5000000000' },
      'La graine doit aller de 0 à 4294967295 (reçu : 5000000000).',
    ],
    [
      { kind: 'parametre-illisible', texte: 'pvA' },
      'Paramètre « pvA » illisible : écrire nom=valeur.',
    ],
    // Les problèmes de chargement et de lot ont leurs propres textes, partagés avec le serveur.
    [
      { kind: 'module-introuvable', chemin: 'x.ts', message: 'Cannot find module' },
      'Impossible de charger « x.ts » : Cannot find module',
    ],
    [
      {
        kind: 'manifeste-illisible',
        chemin: 'des/systeme.json',
        message: 'un objet JSON est attendu',
      },
      '« des/systeme.json » illisible : un objet JSON est attendu',
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
      { kind: 'export-invalide', chemin: 'x.ts' },
      "« x.ts » n'exporte pas de système par défaut (definition et simuler).",
    ],
    [{ kind: 'lot-annule' }, 'Lot annulé avant la fin.'],
  ])('%j', (probleme, message) => {
    expect(expliquer(probleme)).toBe(message);
  });

  it.each<ProblemeDeLot>([
    { kind: 'definition-invalide', defauts: [{ kind: 'version-vide' }] },
    { kind: 'iterations-invalides', iterations: 0 },
    { kind: 'simultanees-invalides', simultanees: 0 },
    { kind: 'valeurs-invalides', erreurs: [{ kind: 'parametre-inconnu', nom: 'x' }] },
    { kind: 'lot-annule' },
    { kind: 'simulation-en-echec', index: 1, graine: graine(2), message: 'boum' },
    { kind: 'resultat-invalide', index: 1, graine: graine(2), erreurs: [{ kind: 'pas-un-objet' }] },
  ])('reprend le texte du runner pour $kind', (probleme) => {
    expect(expliquer(probleme)).toBe(expliquerUnProblemeDeLot(probleme));
  });
});
