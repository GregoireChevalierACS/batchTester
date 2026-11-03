import { err, ok, type Result } from './Result.ts';

interface Nomme {
  readonly nom: string;
  /** Texte affiché à la place du nom (graphiques, rapports). */
  readonly libelle?: string;
}

/** Un nombre par itération : durée d'une partie, dégâts infligés… */
export interface DefMesureNombre extends Nomme {
  readonly kind: 'nombre';
  readonly unite?: string;
}

/** Une catégorie par itération, parmi une liste fermée : vainqueur, issue… */
export interface DefMesureCategorie extends Nomme {
  readonly kind: 'categorie';
  readonly categories: readonly string[];
}

/** Une suite de nombres par itération, un par tour : points de vie, ressources… */
export interface DefMesureSerie extends Nomme {
  readonly kind: 'serie';
  readonly unite?: string;
}

export type DefMesure = DefMesureNombre | DefMesureCategorie | DefMesureSerie;

export type ValeurDeMesure = number | string | readonly number[];

/** Ce que renvoie une itération : la valeur de chaque mesure, indexée par son nom. */
export type Resultat = Readonly<Record<string, ValeurDeMesure>>;

export interface DefautDeMesure {
  readonly kind: 'categories-invalides';
  readonly nom: string;
}

export type ErreurDeResultat =
  | { readonly kind: 'pas-un-objet' }
  | { readonly kind: 'mesure-manquante'; readonly nom: string }
  | { readonly kind: 'mesure-inattendue'; readonly nom: string }
  | { readonly kind: 'type-incorrect'; readonly nom: string }
  | { readonly kind: 'categorie-inconnue'; readonly nom: string; readonly valeur: string };

/** Défauts d'une mesure prise isolément (l'unicité des noms se vérifie sur toute la définition). */
export function verifierUneMesure(def: DefMesure): readonly DefautDeMesure[] {
  if (def.kind !== 'categorie') return [];
  const valides =
    def.categories.length > 0 && new Set(def.categories).size === def.categories.length;
  return valides ? [] : [{ kind: 'categories-invalides', nom: def.nom }];
}

const estUnNombreFini = (valeur: unknown): valeur is number =>
  // Stryker disable next-line ConditionalExpression: typeof sert au typage, Number.isFinite refuse déjà tout ce qui n'est pas un nombre
  typeof valeur === 'number' && Number.isFinite(valeur);

function lireUneMesure(
  def: DefMesure,
  valeur: unknown,
): Result<ValeurDeMesure, 'type-incorrect' | 'categorie-inconnue'> {
  switch (def.kind) {
    case 'nombre':
      return estUnNombreFini(valeur) ? ok(valeur) : err('type-incorrect');
    case 'categorie':
      if (typeof valeur !== 'string') return err('type-incorrect');
      return def.categories.includes(valeur) ? ok(valeur) : err('categorie-inconnue');
    case 'serie': {
      if (!Array.isArray(valeur)) return err('type-incorrect');
      const elements: readonly unknown[] = valeur;
      const nombres = elements.filter(estUnNombreFini);
      return nombres.length === elements.length ? ok(nombres) : err('type-incorrect');
    }
  }
}

/**
 * Vérifie ce qu'a renvoyé une itération. Le système peut venir d'ailleurs (un autre processus,
 * un autre langage) : rien n'entre dans les statistiques sans correspondre à la définition.
 */
export function verifierLeResultat(
  defs: readonly DefMesure[],
  brut: unknown,
): Result<Resultat, readonly ErreurDeResultat[]> {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return err([{ kind: 'pas-un-objet' }]);
  }
  const champs = new Map<string, unknown>(Object.entries(brut));
  const noms = new Set(defs.map((def) => def.nom));
  const erreurs: ErreurDeResultat[] = [...champs.keys()]
    .filter((nom) => !noms.has(nom))
    .map((nom) => ({ kind: 'mesure-inattendue', nom }));
  const resultat: Record<string, ValeurDeMesure> = {};
  for (const def of defs) {
    if (!champs.has(def.nom)) {
      erreurs.push({ kind: 'mesure-manquante', nom: def.nom });
      continue;
    }
    const valeur = champs.get(def.nom);
    const lue = lireUneMesure(def, valeur);
    if (lue.ok) resultat[def.nom] = lue.value;
    else if (lue.error === 'type-incorrect') erreurs.push({ kind: 'type-incorrect', nom: def.nom });
    else erreurs.push({ kind: 'categorie-inconnue', nom: def.nom, valeur: String(valeur) });
  }
  return erreurs.length === 0 ? ok(resultat) : err(erreurs);
}
