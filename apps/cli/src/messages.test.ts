import { describe, expect, it } from 'vitest';
import { graine } from '@batchtester/runner/testing';
import { expliquer, type Probleme } from './messages.ts';

describe('expliquer un problème', () => {
  it.each<[Probleme, string]>([
    [
      { kind: 'arguments-invalides', message: "Unknown option '--x'" },
      "Arguments invalides : Unknown option '--x'",
    ],
    [{ kind: 'systeme-absent' }, 'Indiquer le chemin du système à simuler.'],
    [
      { kind: 'trop-de-systemes', chemins: ['a.ts', 'b.ts'] },
      'Un seul système à la fois (reçu : a.ts, b.ts).',
    ],
    [
      { kind: 'entier-illisible', option: '--iterations', texte: 'x' },
      '--iterations attend un entier positif (reçu : « x »).',
    ],
    [
      { kind: 'graine-hors-limites', texte: '5000000000' },
      'La graine doit aller de 0 à 4294967295 (reçu : 5000000000).',
    ],
    [
      { kind: 'parametre-illisible', texte: 'pvA' },
      'Paramètre « pvA » illisible : écrire nom=valeur.',
    ],
    [
      { kind: 'module-introuvable', chemin: 'x.ts', message: 'Cannot find module' },
      'Impossible de charger « x.ts » : Cannot find module',
    ],
    [
      { kind: 'export-invalide', chemin: 'x.ts' },
      "« x.ts » n'exporte pas de système par défaut (definition et simuler).",
    ],
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
    expect(expliquer(probleme)).toBe(message);
  });

  it('liste chaque défaut de la définition', () => {
    expect(
      expliquer({
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
      expliquer({
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
      expliquer({
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
