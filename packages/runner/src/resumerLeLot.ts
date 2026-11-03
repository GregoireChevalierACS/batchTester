import {
  agregerLesSeries,
  frequences,
  histogramme,
  resumer,
  type DefinitionDeSysteme,
  type DefMesure,
  type DefMesureCategorie,
  type DefMesureNombre,
  type DefMesureSerie,
  type Frequence,
  type Graine,
  type Histogramme,
  type PointDeSerie,
  type Resume,
  type Valeurs,
} from '@batchtester/core';
import type { Lot } from './lancerUnLot.ts';

export type ResumeDeMesure =
  | {
      readonly kind: 'nombre';
      readonly mesure: DefMesureNombre;
      readonly resume: Resume | null;
      readonly histogramme: Histogramme;
    }
  | {
      readonly kind: 'categorie';
      readonly mesure: DefMesureCategorie;
      readonly frequences: readonly Frequence[];
    }
  | {
      readonly kind: 'serie';
      readonly mesure: DefMesureSerie;
      readonly points: readonly PointDeSerie[];
    };

export interface ResumeDeLot {
  readonly definition: DefinitionDeSysteme;
  readonly valeurs: Valeurs;
  readonly graine: Graine;
  readonly iterations: number;
  readonly mesures: readonly ResumeDeMesure[];
}

/** Statistiques de chaque mesure d'un lot : ce que montrent le rapport et les graphiques. */
export function resumerLeLot(lot: Lot): ResumeDeLot {
  const valeursDe = (mesure: DefMesure) =>
    lot.iterations.map(({ resultat }) => resultat[mesure.nom]);

  const resumerUneMesure = (mesure: DefMesure): ResumeDeMesure => {
    switch (mesure.kind) {
      case 'nombre': {
        const nombres = valeursDe(mesure).filter((v) => typeof v === 'number');
        return {
          kind: 'nombre',
          mesure,
          resume: resumer(nombres),
          histogramme: histogramme(nombres),
        };
      }
      case 'categorie': {
        const categories = valeursDe(mesure).filter((v) => typeof v === 'string');
        return { kind: 'categorie', mesure, frequences: frequences(categories, mesure.categories) };
      }
      case 'serie': {
        const series = valeursDe(mesure).filter((v) => typeof v === 'object');
        return { kind: 'serie', mesure, points: agregerLesSeries(series) };
      }
    }
  };

  return {
    definition: lot.definition,
    valeurs: lot.valeurs,
    graine: lot.graine,
    iterations: lot.iterations.length,
    mesures: lot.definition.mesures.map(resumerUneMesure),
  };
}
