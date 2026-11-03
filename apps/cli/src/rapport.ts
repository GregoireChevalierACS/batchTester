import {
  elementA,
  type Frequence,
  type Histogramme,
  type PointDeSerie,
  type Resume,
  type ValeurDeParametre,
} from '@batchtester/core';
import type { ResumeDeLot, ResumeDeMesure } from '@batchtester/runner';

const LARGEUR_DES_BARRES = 30;
/** Au-delà, une série n'affiche qu'un échantillon régulier de ses tours, dont le dernier. */
const POINTS_DE_SERIE_AFFICHES = 10;

/** Nombre à la française, deux décimales au plus : « 12 », « 0,5 », « -3,14 ». */
export function formaterNombre(x: number): string {
  const arrondi = Math.round(x * 100) / 100;
  // Évite « -0 » quand une petite valeur négative s'arrondit à zéro.
  return String(arrondi === 0 ? 0 : arrondi).replace('.', ',');
}

export const formaterPourcentage = (p: number): string =>
  `${(p * 100).toFixed(1).replace('.', ',')} %`;

// Le maximum est toujours positif : chaque liste affichée compte au moins une itération.
const barre = (effectif: number, maximum: number): string =>
  '█'.repeat(Math.round((effectif / maximum) * LARGEUR_DES_BARRES));

const colonne = (textes: readonly string[]): number => Math.max(...textes.map((t) => t.length));

const titreDe = (mesure: ResumeDeMesure['mesure']): string => {
  const titre = mesure.libelle ?? mesure.nom;
  return mesure.kind !== 'categorie' && mesure.unite !== undefined
    ? `${titre} (${mesure.unite})`
    : titre;
};

function lignesDeFrequences(frequences: readonly Frequence[]): string[] {
  if (frequences.length === 0) return ['  aucune valeur'];
  const largeur = colonne(frequences.map((f) => f.categorie));
  const maximum = Math.max(...frequences.map((f) => f.effectif));
  const lignes = frequences.map((f) => ({
    debut: `  ${f.categorie.padEnd(largeur)}  ${formaterPourcentage(f.proportion).padStart(7)}`,
    intervalle: `[${formaterPourcentage(f.basse)} – ${formaterPourcentage(f.haute)}]`,
    effectif: f.effectif,
  }));
  const largeurDesIntervalles = colonne(lignes.map((l) => l.intervalle));
  return lignes.map(({ debut, intervalle, effectif }) =>
    `${debut}  ${intervalle.padEnd(largeurDesIntervalles)}  ${barre(effectif, maximum)}`.trimEnd(),
  );
}

function lignesDeResume(resume: Resume | null): string[] {
  if (resume === null) return ['  aucune valeur'];
  const f = formaterNombre;
  return [
    `  moyenne ${f(resume.moyenne)} · écart-type ${f(resume.ecartType)}`,
    `  min ${f(resume.min)} · p5 ${f(resume.p5)} · p25 ${f(resume.p25)} · médiane ${f(resume.mediane)}` +
      ` · p75 ${f(resume.p75)} · p95 ${f(resume.p95)} · max ${f(resume.max)}`,
  ];
}

function lignesDHistogramme({ discret, classes }: Histogramme): string[] {
  const lignes = classes.map((c) => ({
    etiquette: discret
      ? formaterNombre(c.debut)
      : `${formaterNombre(c.debut)} – ${formaterNombre(c.fin)}`,
    effectif: c.effectif,
  }));
  const largeur = colonne(lignes.map((l) => l.etiquette));
  const maximum = Math.max(...lignes.map((l) => l.effectif));
  return lignes.map(
    ({ etiquette, effectif }) =>
      `  ${etiquette.padStart(largeur)} │${barre(effectif, maximum).padEnd(LARGEUR_DES_BARRES)} ${String(effectif)}`,
  );
}

/** Indices affichés : un échantillon régulier, toujours avec le premier et le dernier. */
export function indicesAffiches(longueur: number): number[] {
  if (longueur <= POINTS_DE_SERIE_AFFICHES) return Array.from({ length: longueur }, (_, i) => i);
  const pas = (longueur - 1) / (POINTS_DE_SERIE_AFFICHES - 1);
  return Array.from({ length: POINTS_DE_SERIE_AFFICHES }, (_, i) => Math.round(i * pas));
}

function lignesDeSerie(points: readonly PointDeSerie[]): string[] {
  if (points.length === 0) return ['  aucune valeur'];
  const largeur = String(points.length - 1).length;
  return indicesAffiches(points.length).map((i) => {
    const p = elementA(points, i);
    return (
      `  ${String(p.indice).padStart(largeur)} : moyenne ${formaterNombre(p.moyenne)}` +
      `  [${formaterNombre(p.min)} – ${formaterNombre(p.max)}]  sur ${String(p.n)}`
    );
  });
}

function sectionDeMesure(resume: ResumeDeMesure): string[] {
  switch (resume.kind) {
    case 'categorie':
      return [titreDe(resume.mesure), ...lignesDeFrequences(resume.frequences)];
    case 'nombre':
      return [
        titreDe(resume.mesure),
        ...lignesDeResume(resume.resume),
        ...lignesDHistogramme(resume.histogramme),
      ];
    case 'serie':
      return [titreDe(resume.mesure), ...lignesDeSerie(resume.points)];
  }
}

const formaterUneValeur = (valeur: ValeurDeParametre | undefined): string => {
  if (typeof valeur === 'number') return formaterNombre(valeur);
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non';
  return String(valeur);
};

/** Rapport texte d'un lot : ce qu'affiche la ligne de commande. */
export function formaterLeRapport(resume: ResumeDeLot): string {
  const { definition, valeurs } = resume;
  const lignes = definition.parametres.map((p) => ({
    nom: p.nom,
    valeur: formaterUneValeur(valeurs[p.nom]),
    libelle: p.libelle === undefined ? '' : `  ${p.libelle}`,
  }));
  const largeurDesNoms = colonne(lignes.map((l) => l.nom));
  const largeurDesValeurs = colonne(lignes.map((l) => l.valeur));
  const parametres = lignes.map(({ nom, valeur, libelle }) =>
    `  ${nom.padEnd(largeurDesNoms)}  ${valeur.padEnd(largeurDesValeurs)}${libelle}`.trimEnd(),
  );
  const sections = [
    [
      `${definition.nom} — version ${definition.version}`,
      `${String(resume.iterations)} itérations · graine ${String(resume.graine)}`,
    ],
    ['Paramètres', ...(parametres.length === 0 ? ['  aucun'] : parametres)],
    ...resume.mesures.map(sectionDeMesure),
  ];
  return `${sections.map((lignes) => lignes.join('\n')).join('\n\n')}\n`;
}
