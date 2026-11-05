import {
  lireUnBooleen,
  lireUnNombre,
  lireUnTexte,
  type Aleatoire,
  type Systeme,
  type Valeurs,
} from '@batchtester/core';

// Mini jeu de cartes à deux joueurs. Chaque paquet est tiré au hasard : des créatures dont le
// coût va de 1 à coutMax, avec 2 × coût + 1 points répartis entre attaque et PV selon
// l'agressivité du joueur. À son tour, un joueur pioche, pose les créatures qu'il peut payer
// (les plus chères d'abord), puis ses créatures déjà en jeu attaquent : la première créature
// adverse, ou le héros s'il n'y en a pas. Un paquet vide fait perdre des PV, de plus en plus.

type Joueur = 'A' | 'B';

const JOUEURS = ['A', 'B'] as const;

/** Au-delà, la partie est déclarée nulle : deux paquets trop défensifs pourraient ne jamais finir. */
export const TOURS_MAXIMAUX = 60;

interface Carte {
  readonly cout: number;
  readonly attaque: number;
  readonly pv: number;
}

interface Creature {
  readonly attaque: number;
  pv: number;
}

interface Etat {
  pv: number;
  readonly paquet: Carte[];
  readonly main: Carte[];
  terrain: Creature[];
  /** Dégâts de la prochaine pioche dans un paquet vide. */
  fatigue: number;
  cartesJouees: number;
}

/** Une créature de coût donné : 2 × coût + 1 points, au moins 1 PV. */
export function carteDeCout(cout: number, agressivite: number): Carte {
  const points = 2 * cout + 1;
  const attaque = Math.min(points - 1, Math.round(points * agressivite));
  return { cout, attaque, pv: points - attaque };
}

const adversaire = (joueur: Joueur): Joueur => (joueur === 'A' ? 'B' : 'A');

/** Pose les cartes de la main, les plus chères d'abord, tant que le mana le permet. */
function jouerLaMain(etat: Etat, mana: number): void {
  let reste = mana;
  for (const carte of [...etat.main].sort((x, y) => y.cout - x.cout)) {
    if (carte.cout > reste) continue;
    reste -= carte.cout;
    etat.main.splice(etat.main.indexOf(carte), 1);
    etat.terrain.push({ attaque: carte.attaque, pv: carte.pv });
    etat.cartesJouees += 1;
  }
}

/** Chaque attaquant frappe la première créature adverse (qui riposte), ou le héros. */
function attaquer(attaquants: readonly Creature[], cible: Etat): void {
  for (const creature of attaquants) {
    const [defenseur] = cible.terrain;
    if (defenseur === undefined) {
      cible.pv -= creature.attaque;
      continue;
    }
    defenseur.pv -= creature.attaque;
    creature.pv -= defenseur.attaque;
    cible.terrain = cible.terrain.filter((c) => c.pv > 0);
  }
}

function regles(valeurs: Valeurs) {
  return {
    tailleDuPaquet: lireUnNombre(valeurs, 'tailleDuPaquet'),
    mainDeDepart: lireUnNombre(valeurs, 'mainDeDepart'),
    pvDesHeros: lireUnNombre(valeurs, 'pvDesHeros'),
    manaMax: lireUnNombre(valeurs, 'manaMax'),
    coutMax: lireUnNombre(valeurs, 'coutMax'),
    agressivite: {
      A: lireUnNombre(valeurs, 'agressiviteA'),
      B: lireUnNombre(valeurs, 'agressiviteB'),
    },
    avantageDuSecond: lireUnBooleen(valeurs, 'avantageDuSecond'),
    premier: lireUnTexte(valeurs, 'premier'),
  };
}

export const cartes = {
  definition: {
    nom: 'Duel de cartes',
    version: '1.0.0',
    description:
      'Deux paquets de créatures tirés au hasard ; chaque tour, on pioche, on pose ce que le mana permet, puis on attaque.',
    parametres: [
      {
        kind: 'entier',
        nom: 'tailleDuPaquet',
        libelle: 'Cartes par paquet',
        min: 5,
        max: 60,
        defaut: 20,
      },
      {
        kind: 'entier',
        nom: 'mainDeDepart',
        libelle: 'Main de départ',
        min: 0,
        max: 10,
        defaut: 3,
      },
      { kind: 'entier', nom: 'pvDesHeros', libelle: 'PV des héros', min: 1, max: 100, defaut: 20 },
      { kind: 'entier', nom: 'manaMax', libelle: 'Mana maximal', min: 1, max: 10, defaut: 8 },
      {
        kind: 'entier',
        nom: 'coutMax',
        libelle: 'Coût maximal des cartes',
        min: 1,
        max: 10,
        defaut: 6,
      },
      {
        kind: 'nombre',
        nom: 'agressiviteA',
        libelle: 'Agressivité du paquet A',
        min: 0,
        max: 1,
        pas: 0.05,
        defaut: 0.5,
      },
      {
        kind: 'nombre',
        nom: 'agressiviteB',
        libelle: 'Agressivité du paquet B',
        min: 0,
        max: 1,
        pas: 0.05,
        defaut: 0.5,
      },
      {
        kind: 'booleen',
        nom: 'avantageDuSecond',
        libelle: 'Une carte de plus pour le second joueur',
        defaut: true,
      },
      {
        kind: 'choix',
        nom: 'premier',
        libelle: 'Qui joue en premier',
        options: ['aleatoire', 'A', 'B'],
        defaut: 'aleatoire',
      },
    ],
    mesures: [
      { kind: 'categorie', nom: 'vainqueur', libelle: 'Vainqueur', categories: ['A', 'B', 'nul'] },
      {
        kind: 'categorie',
        nom: 'gagnantSelonLOrdre',
        libelle: 'Gagnant selon l’ordre de jeu',
        categories: ['premier', 'second', 'nul'],
      },
      { kind: 'nombre', nom: 'tours', libelle: 'Durée', unite: 'tours' },
      { kind: 'nombre', nom: 'cartesJoueesA', libelle: 'Cartes jouées par A', unite: 'cartes' },
      { kind: 'serie', nom: 'pvA', libelle: 'PV du héros A par tour', unite: 'PV' },
      { kind: 'serie', nom: 'pvB', libelle: 'PV du héros B par tour', unite: 'PV' },
    ],
  },

  simuler(valeurs: Valeurs, aleatoire: Aleatoire) {
    const r = regles(valeurs);
    const premier: Joueur =
      r.premier === 'A' || r.premier === 'B' ? r.premier : aleatoire.choisir(JOUEURS);
    const second = adversaire(premier);
    const nouvelEtat = (joueur: Joueur): Etat => {
      const paquet = Array.from({ length: r.tailleDuPaquet }, () =>
        carteDeCout(aleatoire.entier(1, r.coutMax), r.agressivite[joueur]),
      );
      const enMain = r.mainDeDepart + (joueur === second && r.avantageDuSecond ? 1 : 0);
      return {
        pv: r.pvDesHeros,
        main: paquet.splice(0, enMain),
        paquet,
        terrain: [],
        fatigue: 1,
        cartesJouees: 0,
      };
    };
    const etats = { A: nouvelEtat('A'), B: nouvelEtat('B') };
    // Indice 0 : PV de départ ; indice t : PV à la fin du tour t.
    const historique = { A: [etats.A.pv], B: [etats.B.pv] };
    const noterLeTour = () => {
      historique.A.push(Math.max(0, etats.A.pv));
      historique.B.push(Math.max(0, etats.B.pv));
    };
    const resultat = (vainqueur: Joueur | 'nul', tours: number) => ({
      vainqueur,
      gagnantSelonLOrdre:
        vainqueur === 'nul' ? 'nul' : vainqueur === premier ? 'premier' : 'second',
      tours,
      cartesJoueesA: etats.A.cartesJouees,
      pvA: historique.A,
      pvB: historique.B,
    });

    for (let tour = 1; tour <= TOURS_MAXIMAUX; tour += 1) {
      for (const joueur of [premier, second]) {
        const etat = etats[joueur];
        const cible = etats[adversaire(joueur)];
        const carte = etat.paquet.shift();
        if (carte === undefined) {
          etat.pv -= etat.fatigue;
          etat.fatigue += 1;
        } else {
          etat.main.push(carte);
        }
        // Les créatures posées ce tour-ci n'attaquent qu'au tour suivant.
        const dejaEnJeu = [...etat.terrain];
        jouerLaMain(etat, Math.min(tour, r.manaMax));
        attaquer(dejaEnJeu, cible);
        etat.terrain = etat.terrain.filter((c) => c.pv > 0);
        const perdant = etat.pv <= 0 ? joueur : cible.pv <= 0 ? adversaire(joueur) : null;
        if (perdant !== null) {
          noterLeTour();
          return resultat(adversaire(perdant), tour);
        }
      }
      noterLeTour();
    }
    return resultat('nul', TOURS_MAXIMAUX);
  },
} satisfies Systeme;
