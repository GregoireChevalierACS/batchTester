import {
  lireUnNombre,
  lireUnTexte,
  type Aleatoire,
  type DefParametre,
  type Systeme,
  type Valeurs,
} from '@batchtester/core';

// Combat 1 contre 1 au tour par tour. À chaque tour, chaque combattant frappe une fois, dans
// l'ordre fixé par l'initiative. Une frappe touche selon la précision, inflige les dégâts de base
// à ± 20 %, doublés sur un coup critique. Le premier à 0 PV perd ; au-delà de toursMax, match nul.

type Camp = 'A' | 'B';

const CAMPS = ['A', 'B'] as const;

interface Combattant {
  readonly pv: number;
  readonly degats: number;
  readonly precision: number;
  readonly critique: number;
}

const parametresDuCamp = (camp: Camp, defauts: Combattant): DefParametre[] => [
  {
    kind: 'entier',
    nom: `pv${camp}`,
    libelle: `PV de ${camp}`,
    min: 1,
    max: 1000,
    defaut: defauts.pv,
  },
  {
    kind: 'entier',
    nom: `degats${camp}`,
    libelle: `Dégâts de ${camp}`,
    min: 1,
    max: 200,
    defaut: defauts.degats,
  },
  {
    kind: 'nombre',
    nom: `precision${camp}`,
    libelle: `Précision de ${camp}`,
    min: 0,
    max: 1,
    pas: 0.01,
    defaut: defauts.precision,
  },
  {
    kind: 'nombre',
    nom: `critique${camp}`,
    libelle: `Chance de critique de ${camp}`,
    min: 0,
    max: 1,
    pas: 0.01,
    defaut: defauts.critique,
  },
];

const lireLeCombattant = (valeurs: Valeurs, camp: Camp): Combattant => ({
  pv: lireUnNombre(valeurs, `pv${camp}`),
  degats: lireUnNombre(valeurs, `degats${camp}`),
  precision: lireUnNombre(valeurs, `precision${camp}`),
  critique: lireUnNombre(valeurs, `critique${camp}`),
});

/** Dégâts d'une frappe : 0 si elle manque, sinon les dégâts de base à ± 20 %, doublés en critique. */
function frapper(attaquant: Combattant, aleatoire: Aleatoire): number {
  if (!aleatoire.chance(attaquant.precision)) return 0;
  // ± 20 % en entiers : pas d'arrondi flottant (15 × 0,8 vaut 12,000000000000002).
  const variation = Math.floor(attaquant.degats / 5);
  const base = aleatoire.entier(attaquant.degats - variation, attaquant.degats + variation);
  return aleatoire.chance(attaquant.critique) ? base * 2 : base;
}

export const combat = {
  definition: {
    nom: 'Combat 1 contre 1',
    version: '1.0.0',
    description: 'Deux combattants frappent chacun leur tour ; le premier à 0 PV perd.',
    parametres: [
      ...parametresDuCamp('A', { pv: 100, degats: 12, precision: 0.8, critique: 0.1 }),
      ...parametresDuCamp('B', { pv: 120, degats: 10, precision: 0.85, critique: 0.1 }),
      {
        kind: 'choix',
        nom: 'initiative',
        libelle: 'Qui frappe en premier',
        options: ['A', 'B', 'aleatoire'],
        defaut: 'aleatoire',
      },
      {
        kind: 'entier',
        nom: 'toursMax',
        libelle: 'Tours avant match nul',
        min: 1,
        max: 1000,
        defaut: 100,
      },
    ],
    mesures: [
      { kind: 'categorie', nom: 'vainqueur', libelle: 'Vainqueur', categories: ['A', 'B', 'nul'] },
      { kind: 'nombre', nom: 'tours', libelle: 'Durée', unite: 'tours' },
      { kind: 'nombre', nom: 'ecart', libelle: 'Écart de PV final (A - B)', unite: 'PV' },
      { kind: 'serie', nom: 'pvA', libelle: 'PV de A par tour', unite: 'PV' },
      { kind: 'serie', nom: 'pvB', libelle: 'PV de B par tour', unite: 'PV' },
    ],
  },

  simuler(valeurs, aleatoire) {
    const combattants = { A: lireLeCombattant(valeurs, 'A'), B: lireLeCombattant(valeurs, 'B') };
    const toursMax = lireUnNombre(valeurs, 'toursMax');
    const initiative = lireUnTexte(valeurs, 'initiative');
    const premier =
      initiative === 'A' || initiative === 'B' ? initiative : aleatoire.choisir(CAMPS);
    const ordre: readonly [Camp, Camp] = premier === 'A' ? ['A', 'B'] : ['B', 'A'];

    const pv = { A: combattants.A.pv, B: combattants.B.pv };
    // Indice 0 : PV de départ ; indice t : PV à la fin du tour t.
    const historique = { A: [pv.A], B: [pv.B] };
    const noterLeTour = () => {
      historique.A.push(pv.A);
      historique.B.push(pv.B);
    };
    const resultat = (vainqueur: Camp | 'nul', tours: number) => ({
      vainqueur,
      tours,
      ecart: pv.A - pv.B,
      pvA: historique.A,
      pvB: historique.B,
    });

    for (let tour = 1; tour <= toursMax; tour += 1) {
      for (const attaquant of ordre) {
        const defenseur = attaquant === 'A' ? 'B' : 'A';
        pv[defenseur] = Math.max(0, pv[defenseur] - frapper(combattants[attaquant], aleatoire));
        if (pv[defenseur] === 0) {
          noterLeTour();
          return resultat(attaquant, tour);
        }
      }
      noterLeTour();
    }
    return resultat('nul', toursMax);
  },
} satisfies Systeme;
