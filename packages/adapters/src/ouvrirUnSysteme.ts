import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { err, ok, type DefinitionDeSysteme, type Result, type Systeme } from '@batchtester/core';
import type { Simulateur } from '@batchtester/runner';
import {
  chargerUnSysteme,
  expliquerUnProblemeDeChargement,
  type ProblemeDeChargement,
} from './chargerUnSysteme.ts';
import { messageDErreur } from './messageDErreur.ts';
import {
  demarrerUnSimulateurExterne,
  expliquerUnProblemeDExterne,
  type ProblemeDExterne,
} from './simulateurExterne.ts';
import { simulateurEnMemoire } from './simulateurEnMemoire.ts';
import { simulateurQuiCede } from './simulateurQuiCede.ts';

/** Fichier qui décrit un système externe : la commande qui le lance. */
export const MANIFESTE = 'systeme.json';

/** Un système prêt à jouer, quel que soit le langage dans lequel il est écrit. */
export interface SystemeOuvert {
  readonly definition: DefinitionDeSysteme;
  readonly simulateur: Simulateur;
  /** Arrête le programme d'un système externe ; sans effet pour un système TypeScript. */
  fermer(): Promise<void>;
}

export type ProblemeDOuverture =
  | ProblemeDeChargement
  | ProblemeDExterne
  | { readonly kind: 'manifeste-illisible'; readonly chemin: string; readonly message: string };

/** Un système TypeScript, joué dans ce processus en rendant la main régulièrement. */
export const systemeTypeScript = (systeme: Systeme): SystemeOuvert => ({
  definition: systeme.definition,
  simulateur: simulateurQuiCede(simulateurEnMemoire(systeme)),
  fermer: () => Promise.resolve(),
});

interface Manifeste {
  readonly commande: string;
  readonly arguments: readonly string[];
}

function lireLeManifeste(texte: string): Result<Manifeste, string> {
  let valeur: unknown;
  try {
    valeur = JSON.parse(texte);
  } catch (erreur) {
    return err(messageDErreur(erreur));
  }
  if (typeof valeur !== 'object' || valeur === null) return err('un objet JSON est attendu');
  const commande = 'commande' in valeur ? valeur.commande : undefined;
  const parametres = 'arguments' in valeur ? valeur.arguments : [];
  if (typeof commande !== 'string' || commande.trim() === '') {
    return err('« commande » doit être un texte non vide');
  }
  if (!Array.isArray(parametres) || !parametres.every((a) => typeof a === 'string')) {
    return err('« arguments » doit être une liste de textes');
  }
  return ok({ commande, arguments: parametres });
}

/**
 * Ouvre le système décrit par `chemin` (relatif à `repertoire`) : un module TypeScript dont
 * l'export par défaut est le système, ou un fichier systeme.json qui lance un programme externe
 * dans son propre dossier.
 */
export async function ouvrirUnSysteme(
  chemin: string,
  repertoire: string,
): Promise<Result<SystemeOuvert, ProblemeDOuverture>> {
  if (basename(chemin) !== MANIFESTE) {
    const charge = await chargerUnSysteme(chemin, repertoire);
    return charge.ok ? ok(systemeTypeScript(charge.value)) : charge;
  }
  const fichier = resolve(repertoire, chemin);
  let texte: string;
  try {
    texte = await readFile(fichier, 'utf8');
  } catch (erreur) {
    return err({ kind: 'manifeste-illisible', chemin, message: messageDErreur(erreur) });
  }
  const manifeste = lireLeManifeste(texte);
  if (!manifeste.ok) return err({ kind: 'manifeste-illisible', chemin, message: manifeste.error });
  const demarre = await demarrerUnSimulateurExterne(
    manifeste.value.commande,
    manifeste.value.arguments,
    {
      repertoire: dirname(fichier),
    },
  );
  if (!demarre.ok) return demarre;
  return ok({
    definition: demarre.value.definition,
    simulateur: demarre.value,
    fermer: () => demarre.value.fermer(),
  });
}

export function expliquerUnProblemeDOuverture(probleme: ProblemeDOuverture): string {
  switch (probleme.kind) {
    case 'module-introuvable':
    case 'export-invalide':
      return expliquerUnProblemeDeChargement(probleme);
    case 'lancement-impossible':
    case 'definition-absente':
    case 'definition-illisible':
      return expliquerUnProblemeDExterne(probleme);
    case 'manifeste-illisible':
      return `« ${probleme.chemin} » illisible : ${probleme.message}`;
  }
}
