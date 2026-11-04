import type { ApercuDeLancement } from '@batchtester/runner';
import { formaterDate, formaterNombre } from '../format.ts';

interface Proprietes {
  readonly lancements: readonly ApercuDeLancement[];
  readonly erreur: string | null;
  /** Lancements choisis pour la comparaison : le premier est A, le second B. */
  readonly selection: readonly number[];
  readonly onBasculer: (id: number) => void;
  readonly onRecharger: (id: number) => void;
  readonly onSupprimer: (id: number) => void;
}

export function Historique({
  lancements,
  erreur,
  selection,
  onBasculer,
  onRecharger,
  onSupprimer,
}: Proprietes) {
  return (
    <section className="historique" aria-label="Historique">
      <h2>Historique</h2>
      {erreur !== null && (
        <p role="alert" className="probleme">
          {erreur}
        </p>
      )}
      {lancements.length === 0 ? (
        <p className="vide">Aucun lancement enregistré.</p>
      ) : (
        <>
          <p className="aide">Cocher deux lancements pour les comparer.</p>
          <ul>
            {lancements.map((l) => {
              const rang = selection.indexOf(l.id);
              const choisi = rang >= 0;
              return (
                <li key={l.id} className={choisi ? 'choisi' : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      checked={choisi}
                      disabled={!choisi && selection.length >= 2}
                      onChange={() => {
                        onBasculer(l.id);
                      }}
                    />
                    {choisi && <span className="badge">{rang === 0 ? 'A' : 'B'}</span>}{' '}
                    <strong>{l.nom}</strong>
                  </label>
                  <small>
                    {l.nomDuSysteme} v{l.version} · {formaterDate(l.date)} · graine{' '}
                    {String(l.graine)} · {formaterNombre(l.iterations)} itérations
                  </small>
                  <span className="actions">
                    <button
                      type="button"
                      aria-label={`Recharger « ${l.nom} »`}
                      onClick={() => {
                        onRecharger(l.id);
                      }}
                    >
                      Recharger
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer « ${l.nom} »`}
                      onClick={() => {
                        onSupprimer(l.id);
                      }}
                    >
                      Supprimer
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
