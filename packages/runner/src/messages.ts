import type {
  DefautDeDefinition,
  DefautDeValeur,
  ErreurDeResultat,
  ErreurDeValeur,
} from '@batchtester/core';
import { ITERATIONS_MAXIMALES, type ProblemeDeLot } from './lancerUnLot.ts';

// Textes affichés par la ligne de commande comme par l'interface : un même problème se lit
// partout de la même façon.

const RAISONS: Readonly<Record<DefautDeValeur, string>> = {
  'type-incorrect': 'type incorrect',
  'hors-bornes': 'hors des bornes',
  'hors-pas': 'pas sur un cran du pas',
  'option-inconnue': 'option inconnue',
};

function defautDeDefinition(defaut: DefautDeDefinition): string {
  switch (defaut.kind) {
    case 'nom-de-systeme-vide':
      return 'le système n’a pas de nom';
    case 'version-vide':
      return 'le système n’a pas de version';
    case 'nom-vide':
      return defaut.section === 'parametre' ? 'un paramètre sans nom' : 'une mesure sans nom';
    case 'nom-en-double':
      return `« ${defaut.nom} » est défini deux fois`;
    case 'bornes-invalides':
      return `« ${defaut.nom} » : bornes invalides`;
    case 'pas-invalide':
      return `« ${defaut.nom} » : pas invalide`;
    case 'options-invalides':
      return `« ${defaut.nom} » : options vides ou en double`;
    case 'defaut-invalide':
      return `« ${defaut.nom} » : valeur par défaut ${RAISONS[defaut.raison]}`;
    case 'categories-invalides':
      return `« ${defaut.nom} » : catégories vides ou en double`;
  }
}

function erreurDeValeur(erreur: ErreurDeValeur): string {
  switch (erreur.kind) {
    case 'parametre-inconnu':
      return `« ${erreur.nom} » : paramètre inconnu`;
    case 'valeur-invalide':
      return `« ${erreur.nom} » = ${JSON.stringify(erreur.valeur)} : ${RAISONS[erreur.raison]}`;
  }
}

function erreurDeResultat(erreur: ErreurDeResultat): string {
  switch (erreur.kind) {
    case 'pas-un-objet':
      return 'le résultat n’est pas un objet';
    case 'mesure-manquante':
      return `mesure « ${erreur.nom} » manquante`;
    case 'mesure-inattendue':
      return `mesure « ${erreur.nom} » absente de la définition`;
    case 'type-incorrect':
      return `mesure « ${erreur.nom} » : type incorrect`;
    case 'categorie-inconnue':
      return `mesure « ${erreur.nom} » : catégorie « ${erreur.valeur} » inconnue`;
  }
}

const liste = (lignes: readonly string[]): string =>
  lignes.map((ligne) => `\n  - ${ligne}`).join('');

/** Message d'un lot refusé ou interrompu, avec de quoi le corriger ou rejouer l'itération. */
export function expliquerUnProblemeDeLot(probleme: ProblemeDeLot): string {
  switch (probleme.kind) {
    case 'definition-invalide':
      return `Définition du système invalide :${liste(probleme.defauts.map(defautDeDefinition))}`;
    case 'iterations-invalides':
      return (
        `Le nombre d'itérations doit aller de 1 à ${String(ITERATIONS_MAXIMALES)} ` +
        `(reçu : ${String(probleme.iterations)}).`
      );
    case 'simultanees-invalides':
      return `Le nombre de simulations simultanées doit être au moins 1 (reçu : ${String(probleme.simultanees)}).`;
    case 'valeurs-invalides':
      return `Valeurs de paramètres invalides :${liste(probleme.erreurs.map(erreurDeValeur))}`;
    case 'lot-annule':
      return 'Lot annulé avant la fin.';
    case 'simulation-en-echec':
      return (
        `L'itération ${String(probleme.index)} (graine ${String(probleme.graine)}) a échoué : ` +
        probleme.message
      );
    case 'resultat-invalide':
      return (
        `L'itération ${String(probleme.index)} (graine ${String(probleme.graine)}) a renvoyé un ` +
        `résultat non conforme :${liste(probleme.erreurs.map(erreurDeResultat))}`
      );
  }
}
