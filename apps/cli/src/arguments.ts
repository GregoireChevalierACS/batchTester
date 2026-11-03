import { parseArgs } from 'node:util';
import { creerGraine, err, ok, type Graine, type Result } from '@batchtester/core';
import { messageDErreur } from './messageDErreur.ts';

export const ITERATIONS_PAR_DEFAUT = 100;
export const GRAINE_PAR_DEFAUT = 1;

export const AIDE = `Usage : pnpm simuler <système> [options]

  <système>                chemin du module dont l'export par défaut est le système

Options :
  -n, --iterations <n>     nombre d'itérations (défaut : ${String(ITERATIONS_PAR_DEFAUT)})
  -g, --graine <n>         graine maître, de 0 à 4294967295 (défaut : ${String(GRAINE_PAR_DEFAUT)})
  -p, --param <nom=val>    remplace la valeur par défaut d'un paramètre (répétable)
      --simultanees <n>    itérations en cours en même temps
      --json               résumé complet en JSON plutôt que le rapport texte
  -h, --aide               affiche cette aide

Exemple :
  pnpm simuler systemes/combat/src/index.ts -n 500 -g 42 -p pvA=120 -p precisionB=0,9
`;

export interface Lancement {
  readonly kind: 'lancer';
  readonly chemin: string;
  readonly iterations: number;
  readonly graine: Graine;
  /** Paires « nom = texte », interprétées plus tard selon la définition du système. */
  readonly parametres: readonly (readonly [string, string])[];
  readonly simultanees: number | null;
  readonly json: boolean;
}

export type Commande = { readonly kind: 'aide' } | Lancement;

export type ErreurDArguments =
  | { readonly kind: 'arguments-invalides'; readonly message: string }
  | { readonly kind: 'systeme-absent' }
  | { readonly kind: 'trop-de-systemes'; readonly chemins: readonly string[] }
  | { readonly kind: 'entier-illisible'; readonly option: string; readonly texte: string }
  | { readonly kind: 'graine-hors-limites'; readonly texte: string }
  | { readonly kind: 'parametre-illisible'; readonly texte: string };

const lireUnEntier = (option: string, texte: string): Result<number, ErreurDArguments> =>
  /^\d+$/.test(texte) ? ok(Number(texte)) : err({ kind: 'entier-illisible', option, texte });

function lireUnParametre(texte: string): Result<readonly [string, string], ErreurDArguments> {
  const egal = texte.indexOf('=');
  if (egal <= 0) return err({ kind: 'parametre-illisible', texte });
  return ok([texte.slice(0, egal).trim(), texte.slice(egal + 1).trim()]);
}

export function lireLesArguments(argv: readonly string[]): Result<Commande, ErreurDArguments> {
  let lus;
  try {
    lus = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        iterations: { type: 'string', short: 'n' },
        graine: { type: 'string', short: 'g' },
        param: { type: 'string', short: 'p', multiple: true, default: [] },
        simultanees: { type: 'string' },
        json: { type: 'boolean', default: false },
        aide: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (erreur) {
    // parseArgs ne lève que des TypeError décrivant l'option fautive.
    return err({
      kind: 'arguments-invalides',
      message: messageDErreur(erreur),
    });
  }
  const { values, positionals } = lus;
  if (values.aide) return ok({ kind: 'aide' });

  const [chemin, ...enTrop] = positionals;
  if (chemin === undefined) return err({ kind: 'systeme-absent' });
  if (enTrop.length > 0) return err({ kind: 'trop-de-systemes', chemins: positionals });

  const iterations = lireUnEntier(
    '--iterations',
    values.iterations ?? String(ITERATIONS_PAR_DEFAUT),
  );
  if (!iterations.ok) return iterations;
  const texteDeGraine = values.graine ?? String(GRAINE_PAR_DEFAUT);
  const nombre = lireUnEntier('--graine', texteDeGraine);
  if (!nombre.ok) return nombre;
  const graine = creerGraine(nombre.value);
  if (!graine.ok) return err({ kind: 'graine-hors-limites', texte: texteDeGraine });
  let simultanees: number | null = null;
  if (values.simultanees !== undefined) {
    const lues = lireUnEntier('--simultanees', values.simultanees);
    if (!lues.ok) return lues;
    simultanees = lues.value;
  }

  const parametres: (readonly [string, string])[] = [];
  for (const texte of values.param) {
    const parametre = lireUnParametre(texte);
    if (!parametre.ok) return parametre;
    parametres.push(parametre.value);
  }

  return ok({
    kind: 'lancer',
    chemin,
    iterations: iterations.value,
    graine: graine.value,
    parametres,
    simultanees,
    json: values.json,
  });
}
