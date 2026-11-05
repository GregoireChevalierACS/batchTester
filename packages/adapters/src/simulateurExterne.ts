import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import {
  err,
  ok,
  type DefinitionDeSysteme,
  type Graine,
  type Result,
  type Valeurs,
} from '@batchtester/core';
import type { Simulateur } from '@batchtester/runner';
import { aLaFormeDUneDefinition } from './chargerUnSysteme.ts';

// Protocole d'un système externe, en JSON, une ligne par message (ADR 0003) :
//   programme → moteur, au démarrage : {"definition": {...}}
//   moteur → programme, par itération : {"id": 7, "valeurs": {...}, "graine": 123}
//   programme → moteur, en réponse :    {"id": 7, "resultat": {...}} ou {"id": 7, "erreur": "..."}
// Les identifiants permettent plusieurs itérations en cours à la fois, dans n'importe quel ordre.

/** Au-delà, le programme est jugé bloqué : au démarrage comme pour une itération. */
export const DELAI_PAR_DEFAUT = 10_000;

/** Fin de la sortie d'erreur gardée pour expliquer une panne du programme. */
const FIN_DE_STDERR = 2_000;

export type ProblemeDExterne =
  | { readonly kind: 'lancement-impossible'; readonly commande: string; readonly message: string }
  | { readonly kind: 'definition-absente'; readonly commande: string; readonly message: string }
  | { readonly kind: 'definition-illisible'; readonly commande: string; readonly ligne: string };

export interface SimulateurExterne extends Simulateur {
  /** Termine le programme ; les itérations encore en attente échouent. */
  fermer(): Promise<void>;
}

export interface OptionsExternes {
  /** Répertoire de travail du programme. */
  readonly repertoire: string;
  readonly delai?: number;
}

interface EnAttente {
  readonly resoudre: (resultat: unknown) => void;
  readonly rejeter: (erreur: Error) => void;
  readonly minuterie: ReturnType<typeof setTimeout>;
}

const lireLeJson = (ligne: string): unknown => {
  try {
    const valeur: unknown = JSON.parse(ligne);
    return valeur;
  } catch {
    return undefined;
  }
};

const champ = (valeur: unknown, nom: string): unknown =>
  typeof valeur === 'object' && valeur !== null
    ? new Map<string, unknown>(Object.entries(valeur)).get(nom)
    : undefined;

/**
 * Lance le programme, attend sa définition, puis lui confie les itérations. Le programme est
 * responsable de son hasard : il doit tirer ses nombres de la graine reçue, sans quoi la suite de
 * contrat (même graine, même résultat) le refuse.
 */
export function demarrerUnSimulateurExterne(
  commande: string,
  argumentsDeLaCommande: readonly string[],
  { repertoire, delai = DELAI_PAR_DEFAUT }: OptionsExternes,
): Promise<Result<SimulateurExterne, ProblemeDExterne>> {
  const processus = spawn(commande, [...argumentsDeLaCommande], {
    cwd: repertoire,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const lignes = createInterface({ input: processus.stdout });
  let stderr = '';
  processus.stderr.on('data', (morceau: Buffer) => {
    stderr = (stderr + morceau.toString('utf8')).slice(-FIN_DE_STDERR);
  });
  // Un programme qui vient de s'arrêter ne lit plus : écrire vers lui (EPIPE) ne doit pas faire
  // tomber le moteur ; l'arrêt lui-même est rapporté par l'événement close. Cette course avec
  // le système ne se reproduit pas de façon fiable en test, d'où l'exclusion de la couverture.
  /* v8 ignore next */
  processus.stdin.on('error', () => undefined);

  const enAttente = new Map<number, EnAttente>();
  let dernierId = 0;
  let arrete: string | null = null;

  const toutRejeter = (raison: string) => {
    for (const [id, attente] of enAttente) {
      clearTimeout(attente.minuterie);
      attente.rejeter(new Error(raison));
      enAttente.delete(id);
    }
  };

  /** Se résout à l'arrêt du programme, avec sa raison. */
  const fin = new Promise<string>((resoudre) => {
    processus.on('close', (code) => {
      const sortie = stderr.trim();
      const raison = `le programme s'est arrêté (code ${String(code)})${sortie === '' ? '' : ` : ${sortie}`}`;
      arrete = raison;
      toutRejeter(raison);
      resoudre(raison);
    });
  });

  return new Promise((resoudreLeDemarrage) => {
    let demarre = false;
    const echouer = (probleme: ProblemeDExterne) => {
      if (demarre) return;
      demarre = true;
      clearTimeout(minuterieDeDemarrage);
      processus.kill();
      resoudreLeDemarrage(err(probleme));
    };
    const minuterieDeDemarrage = setTimeout(() => {
      echouer({
        kind: 'definition-absente',
        commande,
        message: `aucune définition reçue en ${String(delai)} ms`,
      });
    }, delai);

    processus.on('error', (erreur) => {
      echouer({ kind: 'lancement-impossible', commande, message: erreur.message });
    });
    void fin.then((raison) => {
      echouer({ kind: 'definition-absente', commande, message: raison });
    });

    let definition: DefinitionDeSysteme | null = null;
    lignes.on('line', (ligne) => {
      const message = lireLeJson(ligne);
      if (definition === null) {
        const candidate = champ(message, 'definition');
        if (!aLaFormeDUneDefinition(candidate)) {
          echouer({ kind: 'definition-illisible', commande, ligne: ligne.slice(0, 200) });
          return;
        }
        definition = candidate;
        demarre = true;
        clearTimeout(minuterieDeDemarrage);
        resoudreLeDemarrage(ok(simulateur(candidate)));
        return;
      }
      const attente = enAttente.get(Number(champ(message, 'id')));
      if (attente === undefined) return;
      enAttente.delete(Number(champ(message, 'id')));
      clearTimeout(attente.minuterie);
      const erreur = champ(message, 'erreur');
      if (erreur === undefined) attente.resoudre(champ(message, 'resultat'));
      // Une erreur est normalement un texte ; tout autre JSON est rapporté tel quel.
      else attente.rejeter(new Error(typeof erreur === 'string' ? erreur : JSON.stringify(erreur)));
    });
  });

  function simulateur(definition: DefinitionDeSysteme): SimulateurExterne {
    return {
      definition,
      simuler: (valeurs: Valeurs, graine: Graine) =>
        new Promise((resoudre, rejeter) => {
          if (arrete !== null) {
            rejeter(new Error(arrete));
            return;
          }
          dernierId += 1;
          const id = dernierId;
          const minuterie = setTimeout(() => {
            enAttente.delete(id);
            rejeter(new Error(`pas de réponse en ${String(delai)} ms`));
          }, delai);
          enAttente.set(id, { resoudre, rejeter, minuterie });
          processus.stdin.write(`${JSON.stringify({ id, valeurs, graine })}\n`);
        }),
      fermer: () => {
        processus.stdin.end();
        const arret = setTimeout(() => processus.kill(), delai);
        return fin.then(() => {
          clearTimeout(arret);
        });
      },
    };
  }
}

export function expliquerUnProblemeDExterne(probleme: ProblemeDExterne): string {
  switch (probleme.kind) {
    case 'lancement-impossible':
      return `Impossible de lancer « ${probleme.commande} » : ${probleme.message}`;
    case 'definition-absente':
      return `« ${probleme.commande} » n'a pas annoncé sa définition : ${probleme.message}`;
    case 'definition-illisible':
      return `« ${probleme.commande} » a annoncé une définition illisible : ${probleme.ligne}`;
  }
}
