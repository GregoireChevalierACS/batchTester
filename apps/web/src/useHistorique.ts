import type { ApercuDeLancement, DemandeDeLotADistance } from '@batchtester/runner';
import { useCallback, useEffect, useState } from 'react';
import type { Api } from './api.ts';

export interface EtatDeLHistorique {
  readonly lancements: readonly ApercuDeLancement[];
  readonly erreur: string | null;
  enregistrer(demande: DemandeDeLotADistance, nom: string): Promise<ApercuDeLancement | null>;
  supprimer(id: number): Promise<void>;
}

const messageDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Liste des lancements enregistrés, rechargée après chaque enregistrement ou suppression. */
export function useHistorique(api: Api): EtatDeLHistorique {
  const [lancements, setLancements] = useState<readonly ApercuDeLancement[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(
    () =>
      api.lancements().then(
        (liste) => {
          setLancements(liste);
          setErreur(null);
        },
        (e: unknown) => {
          setErreur(messageDe(e));
        },
      ),
    [api],
  );

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  return {
    lancements,
    erreur,
    async enregistrer(demande, nom) {
      try {
        const enregistre = await api.enregistrer(demande, nom);
        await rafraichir();
        return enregistre;
      } catch (e) {
        setErreur(messageDe(e));
        return null;
      }
    },
    async supprimer(id) {
      try {
        await api.supprimer(id);
      } catch (e) {
        setErreur(messageDe(e));
      }
      await rafraichir();
    },
  };
}
