import type { Aleatoire } from './Aleatoire.ts';
import {
  verifierUneMesure,
  type DefautDeMesure,
  type DefMesure,
  type Resultat,
} from './Mesures.ts';
import {
  verifierUnParametre,
  type DefautDeParametre,
  type DefParametre,
  type Valeurs,
} from './Parametres.ts';

export interface DefinitionDeSysteme {
  readonly nom: string;
  /** Change à chaque modification des règles : deux lancements ne se comparent qu'à version égale. */
  readonly version: string;
  readonly description?: string;
  readonly parametres: readonly DefParametre[];
  readonly mesures: readonly DefMesure[];
}

/**
 * Le seul contrat qu'un système doit remplir : décrire ses réglages et ses mesures, et jouer une
 * itération. Tout le hasard passe par `aleatoire`, pour que la même graine rejoue la même partie.
 */
export interface Systeme {
  readonly definition: DefinitionDeSysteme;
  simuler(valeurs: Valeurs, aleatoire: Aleatoire): Resultat;
}

export type Section = 'parametre' | 'mesure';

export type DefautDeDefinition =
  | { readonly kind: 'nom-de-systeme-vide' }
  | { readonly kind: 'version-vide' }
  | { readonly kind: 'nom-vide'; readonly section: Section }
  | { readonly kind: 'nom-en-double'; readonly section: Section; readonly nom: string }
  | DefautDeParametre
  | DefautDeMesure;

function defautsDeNoms(noms: readonly string[], section: Section): DefautDeDefinition[] {
  const vus = new Set<string>();
  const defauts: DefautDeDefinition[] = [];
  for (const nom of noms) {
    if (nom.trim() === '') defauts.push({ kind: 'nom-vide', section });
    else if (vus.has(nom)) defauts.push({ kind: 'nom-en-double', section, nom });
    vus.add(nom);
  }
  return defauts;
}

/** Tous les défauts d'une définition ; une liste vide veut dire qu'elle est utilisable. */
export function verifierLaDefinition(def: DefinitionDeSysteme): readonly DefautDeDefinition[] {
  return [
    ...(def.nom.trim() === '' ? [{ kind: 'nom-de-systeme-vide' } as const] : []),
    ...(def.version.trim() === '' ? [{ kind: 'version-vide' } as const] : []),
    ...defautsDeNoms(
      def.parametres.map((p) => p.nom),
      'parametre',
    ),
    ...def.parametres.flatMap(verifierUnParametre),
    ...defautsDeNoms(
      def.mesures.map((m) => m.nom),
      'mesure',
    ),
    ...def.mesures.flatMap(verifierUneMesure),
  ];
}
