import { describe, expect, it } from 'vitest';
import type { Historique } from '../historique.ts';
import type { ResumeDeLot } from '../resumerLeLot.ts';
import { graine } from './doublures.ts';

export const RESUME_DE_TEST: ResumeDeLot = {
  definition: {
    nom: 'Pile ou face',
    version: '1.0.0',
    parametres: [{ kind: 'entier', nom: 'lancers', min: 1, max: 10, defaut: 3 }],
    mesures: [{ kind: 'nombre', nom: 'piles' }],
  },
  valeurs: { lancers: 3 },
  graine: graine(42),
  iterations: 2,
  mesures: [
    {
      kind: 'nombre',
      mesure: { kind: 'nombre', nom: 'piles' },
      resume: null,
      histogramme: { discret: false, classes: [] },
      convergence: [],
    },
  ],
};

/**
 * Ce que tout historique doit garantir, quel que soit son stockage. Chaque adapter rejoue cette
 * suite : un nouvel historique n'est branché que s'il la passe.
 */
export function verifierLeContratDeLHistorique(
  nom: string,
  fabriquer: () => Historique | Promise<Historique>,
): void {
  describe(`contrat de l'historique : ${nom}`, () => {
    it('rend un lancement enregistré tel quel, avec un identifiant et une date', async () => {
      const historique = await fabriquer();
      const enregistre = historique.enregistrer({
        systeme: 'pile',
        nom: 'essai',
        resume: RESUME_DE_TEST,
      });
      expect(enregistre).toMatchObject({ systeme: 'pile', nom: 'essai', resume: RESUME_DE_TEST });
      expect(Number.isInteger(enregistre.id)).toBe(true);
      expect(enregistre.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
      expect(historique.lire(enregistre.id)).toEqual(enregistre);
    });

    it('liste les lancements du plus récent au plus ancien, sans leur résumé', async () => {
      const historique = await fabriquer();
      const premier = historique.enregistrer({
        systeme: 'pile',
        nom: 'un',
        resume: RESUME_DE_TEST,
      });
      const second = historique.enregistrer({
        systeme: 'pile',
        nom: 'deux',
        resume: { ...RESUME_DE_TEST, graine: graine(7), valeurs: { lancers: 5 } },
      });
      expect(historique.lister()).toEqual([
        {
          id: second.id,
          date: second.date,
          systeme: 'pile',
          nom: 'deux',
          nomDuSysteme: 'Pile ou face',
          version: '1.0.0',
          graine: 7,
          iterations: 2,
          valeurs: { lancers: 5 },
        },
        expect.objectContaining({ id: premier.id, nom: 'un' }),
      ]);
    });

    it('supprime un lancement, et le dit quand il n’existait pas', async () => {
      const historique = await fabriquer();
      const { id } = historique.enregistrer({ systeme: 'pile', nom: 'x', resume: RESUME_DE_TEST });
      expect(historique.supprimer(id)).toBe(true);
      expect(historique.lire(id)).toBeNull();
      expect(historique.lister()).toEqual([]);
      expect(historique.supprimer(id)).toBe(false);
    });

    it("ne trouve pas un lancement qui n'existe pas", async () => {
      expect((await fabriquer()).lire(999)).toBeNull();
    });
  });
}
