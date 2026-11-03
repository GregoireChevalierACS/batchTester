import type { Valeurs } from '@batchtester/core';
import type { ResumeDeLot } from '@batchtester/runner';
import { useEffect, useState } from 'react';
import type { Api } from './api.ts';

export interface Reglages {
  readonly valeurs: Valeurs;
  readonly graine: number;
  readonly iterations: number;
}

export interface EtatDuLot {
  readonly enCours: boolean;
  readonly progression: { readonly faites: number; readonly total: number } | null;
  /** Dernier résumé reçu : il reste affiché pendant le calcul du suivant. */
  readonly resume: ResumeDeLot | null;
  readonly probleme: string | null;
}

export const ETAT_INITIAL: EtatDuLot = {
  enCours: false,
  progression: null,
  resume: null,
  probleme: null,
};

/** Attente après le dernier réglage : un curseur qu'on fait glisser ne lance qu'un lot. */
export const DELAI_AVANT_LANCEMENT = 250;

export const MESSAGE_LOT_INTERROMPU = 'Le lot s’est interrompu sans résultat.';

/**
 * Relance le lot à chaque changement de système ou de réglage, et abandonne celui en cours :
 * seul le résultat des réglages affichés compte.
 */
export function useLot(
  api: Api,
  systeme: string | null,
  reglages: Reglages | null,
  delai: number,
): EtatDuLot {
  const [etat, setEtat] = useState(ETAT_INITIAL);

  useEffect(() => {
    if (systeme === null || reglages === null) return;
    const annulation = new AbortController();
    const minuterie = setTimeout(() => {
      setEtat((e) => ({ ...e, enCours: true, progression: null, probleme: null }));
      const demande = {
        systeme,
        graine: reglages.graine,
        iterations: reglages.iterations,
        surcharges: reglages.valeurs,
      };
      void api
        .lancer(
          demande,
          (evenement) => {
            switch (evenement.type) {
              case 'progression':
                setEtat((e) => ({
                  ...e,
                  progression: { faites: evenement.faites, total: evenement.total },
                }));
                break;
              case 'resume':
                setEtat({ ...ETAT_INITIAL, resume: evenement.resume });
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
          annulation.signal,
        )
        .then(() => {
          // Flux terminé sans résumé ni problème : le serveur s'est arrêté en route.
          if (!annulation.signal.aborted) {
            setEtat((e) =>
              e.enCours ? { ...e, enCours: false, probleme: MESSAGE_LOT_INTERROMPU } : e,
            );
          }
        });
    }, delai);
    return () => {
      clearTimeout(minuterie);
      annulation.abort();
    };
  }, [api, systeme, reglages, delai]);

  return etat;
}
