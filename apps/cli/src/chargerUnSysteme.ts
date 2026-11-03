import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { err, ok, type Result, type Systeme } from '@batchtester/core';
import { messageDErreur } from './messageDErreur.ts';

export type ProblemeDeChargement =
  | { readonly kind: 'module-introuvable'; readonly chemin: string; readonly message: string }
  | { readonly kind: 'export-invalide'; readonly chemin: string };

/**
 * Vérifie la forme générale de l'export. Le détail de la définition (bornes, noms en double…)
 * est vérifié ensuite par le runner, qui rapporte chaque défaut.
 */
export function aLaFormeDUnSysteme(candidat: unknown): candidat is Systeme {
  if (typeof candidat !== 'object' || candidat === null) return false;
  if (!('simuler' in candidat) || typeof candidat.simuler !== 'function') return false;
  if (!('definition' in candidat)) return false;
  const { definition } = candidat;
  return (
    typeof definition === 'object' &&
    definition !== null &&
    'nom' in definition &&
    typeof definition.nom === 'string' &&
    'version' in definition &&
    typeof definition.version === 'string' &&
    'parametres' in definition &&
    Array.isArray(definition.parametres) &&
    'mesures' in definition &&
    Array.isArray(definition.mesures)
  );
}

/** Charge le module `chemin` (relatif à `repertoire`) et renvoie son export par défaut. */
export async function chargerUnSysteme(
  chemin: string,
  repertoire: string,
): Promise<Result<Systeme, ProblemeDeChargement>> {
  let module: unknown;
  try {
    module = await import(pathToFileURL(resolve(repertoire, chemin)).href);
  } catch (erreur) {
    return err({ kind: 'module-introuvable', chemin, message: messageDErreur(erreur) });
  }
  const candidat =
    typeof module === 'object' && module !== null && 'default' in module
      ? module.default
      : undefined;
  return aLaFormeDUnSysteme(candidat) ? ok(candidat) : err({ kind: 'export-invalide', chemin });
}
