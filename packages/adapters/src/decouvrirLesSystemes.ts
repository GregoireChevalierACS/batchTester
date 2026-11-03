import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Systeme } from '@batchtester/core';
import { chargerUnSysteme, type ProblemeDeChargement } from './chargerUnSysteme.ts';

/** Point d'entrée attendu dans le dossier de chaque système. */
export const POINT_D_ENTREE = join('src', 'index.ts');

export interface SystemeDecouvert {
  /** Nom du dossier : identifiant stable, utilisé dans les adresses de l'API. */
  readonly id: string;
  readonly systeme: Systeme;
}

export interface Decouverte {
  readonly systemes: readonly SystemeDecouvert[];
  /** Dossiers qui ont un point d'entrée mais pas de système chargeable. */
  readonly problemes: readonly ProblemeDeChargement[];
}

const existe = (chemin: string): Promise<boolean> =>
  stat(chemin).then(
    () => true,
    () => false,
  );

/**
 * Charge chaque sous-dossier de `repertoire` qui contient src/index.ts, par ordre alphabétique.
 * Un dossier sans point d'entrée est ignoré ; un point d'entrée défaillant est rapporté sans
 * empêcher les autres systèmes d'être servis.
 */
export async function decouvrirLesSystemes(repertoire: string): Promise<Decouverte> {
  const entrees = await readdir(repertoire, { withFileTypes: true });
  const dossiers = entrees
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort();
  const systemes: SystemeDecouvert[] = [];
  const problemes: ProblemeDeChargement[] = [];
  for (const id of dossiers) {
    const chemin = join(id, POINT_D_ENTREE);
    if (!(await existe(join(repertoire, chemin)))) continue;
    const charge = await chargerUnSysteme(chemin, repertoire);
    if (charge.ok) systemes.push({ id, systeme: charge.value });
    else problemes.push(charge.error);
  }
  return { systemes, problemes };
}
