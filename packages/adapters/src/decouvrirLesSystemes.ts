import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MANIFESTE,
  ouvrirUnSysteme,
  type ProblemeDOuverture,
  type SystemeOuvert,
} from './ouvrirUnSysteme.ts';

/** Point d'entrée d'un système TypeScript, dans son dossier. */
export const POINT_D_ENTREE = join('src', 'index.ts');

export interface SystemeDecouvert extends SystemeOuvert {
  /** Nom du dossier : identifiant stable, utilisé dans les adresses de l'API. */
  readonly id: string;
}

export interface Decouverte {
  readonly systemes: readonly SystemeDecouvert[];
  /** Dossiers qui ont un point d'entrée ou un manifeste, mais pas de système qui démarre. */
  readonly problemes: readonly ProblemeDOuverture[];
}

const existe = (chemin: string): Promise<boolean> =>
  stat(chemin).then(
    () => true,
    () => false,
  );

/**
 * Ouvre chaque sous-dossier de `repertoire`, par ordre alphabétique : un système TypeScript s'il
 * a src/index.ts, sinon un système externe s'il a systeme.json. Un dossier sans l'un ni l'autre
 * est ignoré ; un système défaillant est rapporté sans empêcher les autres d'être servis.
 */
export async function decouvrirLesSystemes(repertoire: string): Promise<Decouverte> {
  const entrees = await readdir(repertoire, { withFileTypes: true });
  const dossiers = entrees
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort();
  const systemes: SystemeDecouvert[] = [];
  const problemes: ProblemeDOuverture[] = [];
  for (const id of dossiers) {
    const candidats = [join(id, POINT_D_ENTREE), join(id, MANIFESTE)];
    let chemin: string | null = null;
    for (const candidat of candidats) {
      if (chemin === null && (await existe(join(repertoire, candidat)))) chemin = candidat;
    }
    if (chemin === null) continue;
    const ouvert = await ouvrirUnSysteme(chemin, repertoire);
    if (ouvert.ok) systemes.push({ id, ...ouvert.value });
    else problemes.push(ouvert.error);
  }
  return { systemes, problemes };
}
