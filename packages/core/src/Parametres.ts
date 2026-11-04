import { err, ok, type Result } from './Result.ts';

interface Nomme {
  readonly nom: string;
  /** Texte affiché à la place du nom (curseurs, rapports). */
  readonly libelle?: string;
}

/** Réel réglable de min à max, par crans de `pas`. */
export interface DefNombre extends Nomme {
  readonly kind: 'nombre';
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly defaut: number;
}

export interface DefEntier extends Nomme {
  readonly kind: 'entier';
  readonly min: number;
  readonly max: number;
  readonly defaut: number;
}

export interface DefChoix extends Nomme {
  readonly kind: 'choix';
  readonly options: readonly string[];
  readonly defaut: string;
}

export interface DefBooleen extends Nomme {
  readonly kind: 'booleen';
  readonly defaut: boolean;
}

export type DefParametre = DefNombre | DefEntier | DefChoix | DefBooleen;

export type ValeurDeParametre = number | string | boolean;

/** Valeur de chaque paramètre d'un système, indexée par son nom. */
export type Valeurs = Readonly<Record<string, ValeurDeParametre>>;

export type DefautDeValeur = 'type-incorrect' | 'hors-bornes' | 'hors-pas' | 'option-inconnue';

export type DefautDeParametre =
  | { readonly kind: 'bornes-invalides'; readonly nom: string }
  | { readonly kind: 'pas-invalide'; readonly nom: string }
  | { readonly kind: 'options-invalides'; readonly nom: string }
  | { readonly kind: 'defaut-invalide'; readonly nom: string; readonly raison: DefautDeValeur };

export type ErreurDeValeur =
  | { readonly kind: 'parametre-inconnu'; readonly nom: string }
  | {
      readonly kind: 'valeur-invalide';
      readonly nom: string;
      readonly valeur: unknown;
      readonly raison: DefautDeValeur;
    };

// Écart toléré sur la grille du pas : en virgule flottante, 0,07 / 0,01 vaut 7,000000000000001.
const TOLERANCE_DU_PAS = 1e-9;

/** Vérifie qu'une valeur convient au paramètre, et la renvoie typée. */
export function lireUneValeur(
  def: DefParametre,
  valeur: unknown,
): Result<ValeurDeParametre, DefautDeValeur> {
  switch (def.kind) {
    case 'booleen':
      return typeof valeur === 'boolean' ? ok(valeur) : err('type-incorrect');
    case 'choix':
      if (typeof valeur !== 'string') return err('type-incorrect');
      return def.options.includes(valeur) ? ok(valeur) : err('option-inconnue');
    case 'entier':
      if (typeof valeur !== 'number' || !Number.isSafeInteger(valeur)) return err('type-incorrect');
      return valeur < def.min || valeur > def.max ? err('hors-bornes') : ok(valeur);
    case 'nombre': {
      if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return err('type-incorrect');
      if (valeur < def.min || valeur > def.max) return err('hors-bornes');
      const crans = (valeur - def.min) / def.pas;
      // Stryker disable next-line EqualityOperator: un écart d'exactement 1e-9 ne se produit pas, < et ≤ sont indiscernables
      return Math.abs(crans - Math.round(crans)) <= TOLERANCE_DU_PAS ? ok(valeur) : err('hors-pas');
    }
  }
}

function bornesValides(def: DefNombre | DefEntier): boolean {
  const borneValide = def.kind === 'entier' ? Number.isSafeInteger : Number.isFinite;
  return borneValide(def.min) && borneValide(def.max) && def.min <= def.max;
}

function defautDeStructure(def: DefParametre): DefautDeParametre | null {
  switch (def.kind) {
    case 'nombre':
      if (!bornesValides(def)) return { kind: 'bornes-invalides', nom: def.nom };
      return Number.isFinite(def.pas) && def.pas > 0
        ? null
        : { kind: 'pas-invalide', nom: def.nom };
    case 'entier':
      return bornesValides(def) ? null : { kind: 'bornes-invalides', nom: def.nom };
    case 'choix': {
      const valides = def.options.length > 0 && new Set(def.options).size === def.options.length;
      return valides ? null : { kind: 'options-invalides', nom: def.nom };
    }
    case 'booleen':
      return null;
  }
}

/** Défauts d'un paramètre pris isolément (l'unicité des noms se vérifie sur toute la définition). */
export function verifierUnParametre(def: DefParametre): readonly DefautDeParametre[] {
  const structure = defautDeStructure(def);
  // Bornes ou options fausses : la valeur par défaut ne peut pas être jugée.
  if (structure !== null) return [structure];
  const defaut = lireUneValeur(def, def.defaut);
  return defaut.ok ? [] : [{ kind: 'defaut-invalide', nom: def.nom, raison: defaut.error }];
}

export const valeursParDefaut = (defs: readonly DefParametre[]): Valeurs =>
  Object.fromEntries(defs.map((def) => [def.nom, def.defaut]));

/**
 * Valeurs d'un lancement : la valeur par défaut de chaque paramètre, remplacée par la surcharge
 * quand il y en a une. Toutes les erreurs sont rapportées d'un coup, pas seulement la première.
 */
export function resoudreLesValeurs(
  defs: readonly DefParametre[],
  surcharges: Readonly<Record<string, unknown>>,
): Result<Valeurs, readonly ErreurDeValeur[]> {
  const noms = new Set(defs.map((def) => def.nom));
  const erreurs: ErreurDeValeur[] = Object.keys(surcharges)
    .filter((nom) => !noms.has(nom))
    .map((nom) => ({ kind: 'parametre-inconnu', nom }));
  const valeurs: Record<string, ValeurDeParametre> = {};
  for (const def of defs) {
    const valeur = Object.hasOwn(surcharges, def.nom) ? surcharges[def.nom] : def.defaut;
    const lue = lireUneValeur(def, valeur);
    if (lue.ok) valeurs[def.nom] = lue.value;
    else erreurs.push({ kind: 'valeur-invalide', nom: def.nom, valeur, raison: lue.error });
  }
  return erreurs.length === 0 ? ok(valeurs) : err(erreurs);
}

// Accès typé aux valeurs depuis une simulation. Les valeurs ont été vérifiées contre la
// définition avant le lancement : une erreur ici est une faute de frappe dans le système.

function lire<T extends ValeurDeParametre>(
  valeurs: Valeurs,
  nom: string,
  attendu: string,
  estDuBonType: (valeur: unknown) => valeur is T,
): T {
  const valeur = valeurs[nom];
  if (!estDuBonType(valeur)) throw new TypeError(`paramètre « ${nom} » : ${attendu} attendu`);
  return valeur;
}

export const lireUnNombre = (valeurs: Valeurs, nom: string): number =>
  lire(valeurs, nom, 'nombre', (v) => typeof v === 'number');

export const lireUnTexte = (valeurs: Valeurs, nom: string): string =>
  lire(valeurs, nom, 'texte', (v) => typeof v === 'string');

export const lireUnBooleen = (valeurs: Valeurs, nom: string): boolean =>
  lire(valeurs, nom, 'booléen', (v) => typeof v === 'boolean');

// Valeurs d'un balayage : quelles valeurs d'un paramètre essayer, une par point.

/** Au-delà, un axe de balayage n'apprend plus rien et coûte cher. */
export const POINTS_MAXIMAUX_PAR_AXE = 50;

export type ErreurDePlage =
  | { readonly kind: 'points-invalides'; readonly points: number }
  | { readonly kind: 'plage-hors-bornes'; readonly de: number; readonly a: number };

/** Toutes les valeurs d'un paramètre à valeurs fermées : les options d'un choix, ou non et oui. */
export const valeursPossibles = (def: DefChoix | DefBooleen): readonly ValeurDeParametre[] =>
  def.kind === 'choix' ? [...def.options] : [false, true];

// Retire le bruit des flottants : 0,1 + 2 × 0,05 doit valoir 0,2, pas 0,20000000000000004.
const sansBruit = (x: number): number => Number(x.toPrecision(12));

/** Valeur la plus proche de x sur la grille du paramètre, sans dépasser max. */
function surLaGrille(def: DefNombre | DefEntier, x: number): number {
  if (def.kind === 'entier') return Math.round(x);
  const cransMax = Math.floor((def.max - def.min) / def.pas + TOLERANCE_DU_PAS);
  const crans = Math.min(cransMax, Math.round((x - def.min) / def.pas));
  return sansBruit(def.min + crans * def.pas);
}

/**
 * `points` valeurs réparties régulièrement de `de` à `a` (dans un sens ou dans l'autre), ramenées
 * sur la grille du paramètre. Les doublons créés par l'arrondi sont retirés : un entier balayé de
 * 1 à 3 en 10 points ne donne que 1, 2 et 3.
 */
export function valeursEchelonnees(
  def: DefNombre | DefEntier,
  de: number,
  a: number,
  points: number,
): Result<readonly number[], ErreurDePlage> {
  if (!Number.isInteger(points) || points < 1 || points > POINTS_MAXIMAUX_PAR_AXE) {
    return err({ kind: 'points-invalides', points });
  }
  const dansLesBornes = (x: number) => Number.isFinite(x) && x >= def.min && x <= def.max;
  if (!dansLesBornes(de) || !dansLesBornes(a)) return err({ kind: 'plage-hors-bornes', de, a });
  const pas = points === 1 ? 0 : (a - de) / (points - 1);
  const valeurs = Array.from({ length: points }, (_, i) => surLaGrille(def, de + i * pas));
  return ok([...new Set(valeurs)]);
}
