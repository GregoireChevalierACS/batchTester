import type { Balayage, DemandeDeBalayageADistance } from '@batchtester/runner';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from './api.ts';

export interface EtatDuBalayage {
  readonly enCours: boolean;
  readonly progression: { readonly faites: number; readonly total: number } | null;
  readonly balayage: Balayage | null;
  readonly probleme: string | null;
}

export const BALAYAGE_INITIAL: EtatDuBalayage = {
  enCours: false,
  progression: null,
  balayage: null,
  probleme: null,
};

export const MESSAGE_BALAYAGE_ANNULE = 'Balayage annulé.';
export const MESSAGE_BALAYAGE_INTERROMPU = 'Le balayage s’est interrompu sans résultat.';

/**
 * Un balayage coûte cher : il ne part que sur demande, et un seul tourne à la fois. Le relancer
 * ou quitter la page abandonne celui en cours, que le serveur arrête aussitôt.
 */
export function useBalayage(api: Api) {
  const [etat, setEtat] = useState(BALAYAGE_INITIAL);
  const enCours = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      enCours.current?.abort();
    },
    [],
  );

  const lancer = useCallback(
    (demande: DemandeDeBalayageADistance) => {
      enCours.current?.abort();
      const controleur = new AbortController();
      enCours.current = controleur;
      setEtat((e) => ({ ...e, enCours: true, progression: null, probleme: null }));
      void api
        .balayer(
          demande,
          (evenement) => {
            switch (evenement.type) {
              case 'progression':
                setEtat((e) => ({
                  ...e,
                  progression: { faites: evenement.faites, total: evenement.total },
                }));
                break;
              case 'balayage':
                setEtat({ ...BALAYAGE_INITIAL, balayage: evenement.balayage });
                break;
              case 'probleme':
                setEtat((e) => ({
                  ...e,
                  enCours: false,
                  progression: null,
                  probleme: evenement.message,
                }));
                break;
            }
          },
          controleur.signal,
        )
        .then(() => {
          // Remplacé par un balayage plus récent : c'est lui qui décide de l'état.
          if (enCours.current !== controleur) return;
          enCours.current = null;
          const message = controleur.signal.aborted
            ? MESSAGE_BALAYAGE_ANNULE
            : MESSAGE_BALAYAGE_INTERROMPU;
          setEtat((e) =>
            e.enCours ? { ...e, enCours: false, progression: null, probleme: message } : e,
          );
        });
    },
    [api],
  );

  const annuler = useCallback(() => {
    enCours.current?.abort();
  }, []);

  return { ...etat, lancer, annuler };
}
