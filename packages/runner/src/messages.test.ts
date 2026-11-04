import { describe, expect, it } from 'vitest';
import type { ProblemeDeLot } from './lancerUnLot.ts';
import type { ProblemeDeBalayage } from './balayer.ts';
import { expliquerUnProblemeDeBalayage, expliquerUnProblemeDeLot } from './messages.ts';
import { graine } from './testing/index.ts';

describe('expliquer un problème de lot', () => {
  it.each<[ProblemeDeLot, string]>([
    [{ kind: 'lot-annule' }, 'Lot annulé avant la fin.'],
    [
      { kind: 'iterations-invalides', iterations: 0 },
      "Le nombre d'itérations doit aller de 1 à 100000 (reçu : 0).",
    ],
    [
      { kind: 'simultanees-invalides', simultanees: 0 },
      'Le nombre de simulations simultanées doit être au moins 1 (reçu : 0).',
    ],
    [
      { kind: 'simulation-en-echec', index: 3, graine: graine(99), message: 'pv négatifs' },
      "L'itération 3 (graine 99) a échoué : pv négatifs",
    ],
  ])('%j', (probleme, message) => {
    expect(expliquerUnProblemeDeLot(probleme)).toBe(message);
  });

  it('liste chaque défaut de la définition', () => {
    expect(
      expliquerUnProblemeDeLot({
        kind: 'definition-invalide',
        defauts: [
          { kind: 'nom-de-systeme-vide' },
          { kind: 'version-vide' },
          { kind: 'nom-vide', section: 'parametre' },
          { kind: 'nom-vide', section: 'mesure' },
          { kind: 'nom-en-double', section: 'mesure', nom: 'pv' },
          { kind: 'bornes-invalides', nom: 'pv' },
          { kind: 'pas-invalide', nom: 'precision' },
          { kind: 'options-invalides', nom: 'classe' },
          { kind: 'defaut-invalide', nom: 'pv', raison: 'hors-bornes' },
          { kind: 'categories-invalides', nom: 'vainqueur' },
        ],
      }),
    ).toBe(
      [
        'Définition du système invalide :',
        '  - le système n’a pas de nom',
        '  - le système n’a pas de version',
        '  - un paramètre sans nom',
        '  - une mesure sans nom',
        '  - « pv » est défini deux fois',
        '  - « pv » : bornes invalides',
        '  - « precision » : pas invalide',
        '  - « classe » : options vides ou en double',
        '  - « pv » : valeur par défaut hors des bornes',
        '  - « vainqueur » : catégories vides ou en double',
      ].join('\n'),
    );
  });

  it('liste chaque valeur invalide, en citant la valeur reçue', () => {
    expect(
      expliquerUnProblemeDeLot({
        kind: 'valeurs-invalides',
        erreurs: [
          { kind: 'parametre-inconnu', nom: 'vitesse' },
          { kind: 'valeur-invalide', nom: 'pvA', valeur: 'cent', raison: 'type-incorrect' },
          { kind: 'valeur-invalide', nom: 'pvA', valeur: 0, raison: 'hors-bornes' },
          { kind: 'valeur-invalide', nom: 'precision', valeur: 0.123, raison: 'hors-pas' },
          { kind: 'valeur-invalide', nom: 'classe', valeur: 'voleur', raison: 'option-inconnue' },
        ],
      }),
    ).toBe(
      [
        'Valeurs de paramètres invalides :',
        '  - « vitesse » : paramètre inconnu',
        '  - « pvA » = "cent" : type incorrect',
        '  - « pvA » = 0 : hors des bornes',
        '  - « precision » = 0.123 : pas sur un cran du pas',
        '  - « classe » = "voleur" : option inconnue',
      ].join('\n'),
    );
  });

  it('liste chaque écart du résultat, avec de quoi rejouer l’itération', () => {
    expect(
      expliquerUnProblemeDeLot({
        kind: 'resultat-invalide',
        index: 12,
        graine: graine(7),
        erreurs: [
          { kind: 'pas-un-objet' },
          { kind: 'mesure-manquante', nom: 'tours' },
          { kind: 'mesure-inattendue', nom: 'duree' },
          { kind: 'type-incorrect', nom: 'pvA' },
          { kind: 'categorie-inconnue', nom: 'vainqueur', valeur: 'C' },
        ],
      }),
    ).toBe(
      [
        "L'itération 12 (graine 7) a renvoyé un résultat non conforme :",
        '  - le résultat n’est pas un objet',
        '  - mesure « tours » manquante',
        '  - mesure « duree » absente de la définition',
        '  - mesure « pvA » : type incorrect',
        '  - mesure « vainqueur » : catégorie « C » inconnue',
      ].join('\n'),
    );
  });
});

describe('expliquer un problème de balayage', () => {
  it.each<[ProblemeDeBalayage, string]>([
    [{ kind: 'nombre-d-axes', axes: 3 }, 'Un balayage a un ou deux axes (reçu : 3).'],
    [{ kind: 'parametre-inconnu', parametre: 'x' }, '« x » : paramètre inconnu.'],
    [{ kind: 'parametre-en-double', parametre: 'x' }, '« x » est balayé deux fois.'],
    [{ kind: 'axe-vide', parametre: 'x' }, "L'axe « x » n'a aucune valeur."],
    [{ kind: 'trop-de-points', points: 441 }, 'Le balayage a 441 points ; au plus 400.'],
    [
      { kind: 'valeur-hors-definition', parametre: 'pvA', valeur: 0, raison: 'hors-bornes' },
      '« pvA » = 0 : hors des bornes.',
    ],
    [{ kind: 'balayage-annule' }, 'Balayage annulé avant la fin.'],
    [
      { kind: 'point-en-echec', valeurs: [3, 'A'], probleme: { kind: 'lot-annule' } },
      'Le point (3, "A") a échoué : Lot annulé avant la fin.',
    ],
  ])('%j', (probleme, message) => {
    expect(expliquerUnProblemeDeBalayage(probleme)).toBe(message);
  });
});
