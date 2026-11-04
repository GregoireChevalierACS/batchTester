import type { DefMesure } from '@batchtester/core';

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const POURCENTAGE = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** « 12 », « 0,5 », « −3,14 » : deux décimales au plus, à la française. */
export const formaterNombre = (x: number): string => NOMBRE.format(x);

/** Proportion de 0 à 1 affichée en pourcentage, une décimale : « 48,5 % ». */
export const formaterPourcentage = (p: number): string => POURCENTAGE.format(p);

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** Date ISO affichée à l'heure locale : « 04/11/2026 10:30 ». */
export const formaterDate = (iso: string): string => DATE.format(new Date(iso));

/** Écart signé : « +3,5 », « −1,2 », « 0 ». */
export const formaterEcart = (x: number): string => `${x > 0 ? '+' : ''}${formaterNombre(x)}`;

/** Titre d'une mesure, unité comprise : « Durée (tours) ». */
export const titreDeMesure = (mesure: DefMesure): string => {
  const titre = mesure.libelle ?? mesure.nom;
  return mesure.kind !== 'categorie' && mesure.unite !== undefined
    ? `${titre} (${mesure.unite})`
    : titre;
};
