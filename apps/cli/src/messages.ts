import { expliquerUnProblemeDOuverture, type ProblemeDOuverture } from '@batchtester/adapters';
import { expliquerUnProblemeDeLot, type ProblemeDeLot } from '@batchtester/runner';
import type { ErreurDArguments } from './arguments.ts';

export type Probleme = ErreurDArguments | ProblemeDOuverture | ProblemeDeLot;

/** Message affiché pour un problème, en français, avec de quoi le corriger ou le rejouer. */
export function expliquer(probleme: Probleme): string {
  switch (probleme.kind) {
    case 'arguments-invalides':
      return `Arguments invalides : ${probleme.message}`;
    case 'systeme-absent':
      return 'Indiquer le chemin du système à simuler.';
    case 'trop-de-systemes':
      return `Un seul système à la fois (reçu : ${probleme.chemins.join(', ')}).`;
    case 'entier-illisible':
      return `${probleme.option} attend un entier positif (reçu : « ${probleme.texte} »).`;
    case 'graine-hors-limites':
      return `La graine doit aller de 0 à 4294967295 (reçu : ${probleme.texte}).`;
    case 'parametre-illisible':
      return `Paramètre « ${probleme.texte} » illisible : écrire nom=valeur.`;
    case 'module-introuvable':
    case 'export-invalide':
    case 'manifeste-illisible':
    case 'lancement-impossible':
    case 'definition-absente':
    case 'definition-illisible':
      return expliquerUnProblemeDOuverture(probleme);
    case 'definition-invalide':
    case 'iterations-invalides':
    case 'simultanees-invalides':
    case 'valeurs-invalides':
    case 'lot-annule':
    case 'simulation-en-echec':
    case 'resultat-invalide':
      return expliquerUnProblemeDeLot(probleme);
  }
}
