import {
  apercuDe,
  type ApercuDeLancement,
  type Historique,
  type Lancement,
  type LancementAEnregistrer,
} from '../historique.ts';

/** Date ISO déterministe : une seconde de plus à chaque enregistrement. */
const dateNumero = (n: number): string => {
  const deuxChiffres = (x: number) => String(x).padStart(2, '0');
  return `2026-11-04T10:${deuxChiffres(Math.floor(n / 60) % 60)}:${deuxChiffres(n % 60)}.000Z`;
};

/** Historique tenu en mémoire, pour les tests du runner, du serveur et de l'interface. */
export class HistoriqueEnMemoire implements Historique {
  private readonly lancements = new Map<number, Lancement>();
  private dernierId = 0;

  enregistrer(lancement: LancementAEnregistrer): Lancement {
    this.dernierId += 1;
    const enregistre = { ...lancement, id: this.dernierId, date: dateNumero(this.dernierId) };
    this.lancements.set(enregistre.id, enregistre);
    return enregistre;
  }

  lister(): readonly ApercuDeLancement[] {
    return [...this.lancements.values()].reverse().map(apercuDe);
  }

  lire(id: number): Lancement | null {
    return this.lancements.get(id) ?? null;
  }

  supprimer(id: number): boolean {
    return this.lancements.delete(id);
  }
}
