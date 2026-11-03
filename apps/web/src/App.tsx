import { elementA, GRAINE_MAXIMALE } from '@batchtester/core';
import { useEffect, useId, useState } from 'react';
import type { Api, SystemeDisponible } from './api.ts';
import { CarteDeMesure } from './composants/CarteDeMesure.tsx';
import { Formulaire, reglagesParDefaut } from './composants/Formulaire.tsx';
import { formaterNombre } from './format.ts';
import { DELAI_AVANT_LANCEMENT, useLot, type Reglages } from './useLot.ts';

interface Choix {
  readonly systeme: SystemeDisponible;
  readonly reglages: Reglages;
}

const choisir = (systeme: SystemeDisponible): Choix => ({
  systeme,
  reglages: reglagesParDefaut(systeme.definition),
});

/** Le hasard de l'interface n'entre dans aucun calcul : il propose seulement une graine. */
const grainAuHasard = (): number => Math.floor(Math.random() * (GRAINE_MAXIMALE + 1));

interface Proprietes {
  readonly api: Api;
  readonly delai?: number;
  readonly tirerUneGraine?: () => number;
}

export function App({
  api,
  delai = DELAI_AVANT_LANCEMENT,
  tirerUneGraine = grainAuHasard,
}: Proprietes) {
  const idDuChoix = useId();
  const [systemes, setSystemes] = useState<readonly SystemeDisponible[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);

  useEffect(() => {
    api.systemes().then(
      (liste) => {
        setSystemes(liste);
        const [premier] = liste;
        if (premier !== undefined) setChoix(choisir(premier));
      },
      (e: unknown) => {
        setErreur(e instanceof Error ? e.message : String(e));
      },
    );
  }, [api]);

  const lot = useLot(api, choix?.systeme.id ?? null, choix?.reglages ?? null, delai);

  if (erreur !== null) {
    return (
      <main className="seul">
        <p role="alert">Impossible de lister les systèmes : {erreur}</p>
      </main>
    );
  }
  if (systemes === null) return <main className="seul">Chargement des systèmes…</main>;
  if (choix === null) {
    return (
      <main className="seul">
        <p>Aucun système trouvé : ajouter un dossier dans systemes/ avec src/index.ts.</p>
      </main>
    );
  }

  const { definition } = choix.systeme;
  const resume = lot.resume;
  return (
    <>
      <header className="entete">
        <h1>batchTester</h1>
        <label htmlFor={idDuChoix}>Système</label>
        <select
          id={idDuChoix}
          value={String(systemes.indexOf(choix.systeme))}
          onChange={(e) => {
            setChoix(choisir(elementA(systemes, Number(e.target.value))));
          }}
        >
          {systemes.map((s, i) => (
            <option key={s.id} value={String(i)}>
              {s.definition.nom}
            </option>
          ))}
        </select>
        {definition.description !== undefined && (
          <p className="description">{definition.description}</p>
        )}
      </header>
      <main className="studio">
        <aside className="reglages">
          <Formulaire
            key={choix.systeme.id}
            definition={definition}
            reglages={choix.reglages}
            tirerUneGraine={tirerUneGraine}
            onChange={(reglages) => {
              setChoix({ ...choix, reglages });
            }}
          />
        </aside>
        <section className="resultats" aria-label="Résultats" aria-busy={lot.enCours}>
          <div className="etat-du-lot">
            {resume !== null && (
              <p>
                {definition.nom} v{resume.definition.version} · {formaterNombre(resume.iterations)}{' '}
                itérations · graine {String(resume.graine)}
              </p>
            )}
            {lot.enCours && (
              <progress
                aria-label="Avancement du lot"
                max={lot.progression?.total ?? choix.reglages.iterations}
                value={lot.progression?.faites ?? 0}
              />
            )}
          </div>
          {lot.probleme !== null && (
            <p role="alert" className="probleme">
              {lot.probleme}
            </p>
          )}
          <div className={lot.enCours ? 'cartes perime' : 'cartes'}>
            {resume?.mesures.map((mesure) => (
              <CarteDeMesure key={mesure.mesure.nom} resume={mesure} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
