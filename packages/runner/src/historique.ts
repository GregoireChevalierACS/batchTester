import type { ValeurDeParametre, Valeurs } from '@batchtester/core';
import type { ResumeDeLot } from './resumerLeLot.ts';

export interface LancementAEnregistrer {
  /** Identifiant du système (nom de son dossier), pour le relancer. */
  readonly systeme: string;
  readonly nom: string;
  readonly resume: ResumeDeLot;
}

export interface Lancement extends LancementAEnregistrer {
  readonly id: number;
  /** Date ISO 8601 de l'enregistrement. */
  readonly date: string;
}

/** Ce que montre la liste de l'historique, sans le résumé complet. */
export interface ApercuDeLancement {
  readonly id: number;
  readonly date: string;
  readonly systeme: string;
  readonly nom: string;
  readonly nomDuSysteme: string;
  readonly version: string;
  readonly graine: number;
  readonly iterations: number;
  readonly valeurs: Valeurs;
}

/** Lancements enregistrés pour être comparés ou rejoués. */
export interface Historique {
  enregistrer(lancement: LancementAEnregistrer): Lancement;
  /** Du plus récent au plus ancien. */
  lister(): readonly ApercuDeLancement[];
  lire(id: number): Lancement | null;
  /** Faux si le lancement n'existait pas. */
  supprimer(id: number): boolean;
}

export const apercuDe = ({ id, date, systeme, nom, resume }: Lancement): ApercuDeLancement => ({
  id,
  date,
  systeme,
  nom,
  nomDuSysteme: resume.definition.nom,
  version: resume.definition.version,
  graine: resume.graine,
  iterations: resume.iterations,
  valeurs: resume.valeurs,
});

/** Nom proposé par défaut : ce qui distingue un lancement d'un autre du même système. */
export function nomParDefaut(resume: ResumeDeLot): string {
  const valeur = (v: ValeurDeParametre | undefined) => String(v);
  const reglages = resume.definition.parametres
    .map((p) => `${p.nom}=${valeur(resume.valeurs[p.nom])}`)
    .join(', ');
  return `graine ${String(resume.graine)} · ${reglages}`;
}
