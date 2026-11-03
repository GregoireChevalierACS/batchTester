export { creerAleatoire, type Aleatoire } from './Aleatoire.ts';
export {
  creerGraine,
  deriverLaGraine,
  GRAINE_MAXIMALE,
  type ErreurDeGraine,
  type Graine,
} from './Graine.ts';
export { elementA } from './Indexation.ts';
export {
  verifierLeResultat,
  type DefMesure,
  type DefMesureCategorie,
  type DefMesureNombre,
  type DefMesureSerie,
  type ErreurDeResultat,
  type Resultat,
  type ValeurDeMesure,
} from './Mesures.ts';
export {
  lireUnBooleen,
  lireUneValeur,
  lireUnNombre,
  lireUnTexte,
  resoudreLesValeurs,
  valeursParDefaut,
  type DefautDeValeur,
  type DefBooleen,
  type DefChoix,
  type DefEntier,
  type DefNombre,
  type DefParametre,
  type ErreurDeValeur,
  type ValeurDeParametre,
  type Valeurs,
} from './Parametres.ts';
export { err, ok, type Result } from './Result.ts';
export {
  agregerLesSeries,
  frequences,
  histogramme,
  proportionDeWilson,
  quantile,
  resumer,
  type Classe,
  type Frequence,
  type Histogramme,
  type PointDeSerie,
  type Proportion,
  type Resume,
} from './Statistiques.ts';
export {
  verifierLaDefinition,
  type DefautDeDefinition,
  type DefinitionDeSysteme,
  type Section,
  type Systeme,
} from './Systeme.ts';
