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
