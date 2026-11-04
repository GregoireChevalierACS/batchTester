import { elementA, GRAINE_MAXIMALE } from '@batchtester/core';
import type { Lancement, ResumeDeLot } from '@batchtester/runner';
import { useEffect, useId, useState } from 'react';
import type { Api, SystemeDisponible } from './api.ts';
import { CarteDeMesure } from './composants/CarteDeMesure.tsx';
import { Comparaison } from './composants/Comparaison.tsx';
import { Formulaire, reglagesParDefaut } from './composants/Formulaire.tsx';
import { Historique } from './composants/Historique.tsx';
import { formaterNombre } from './format.ts';
import { useHistorique } from './useHistorique.ts';
import { DELAI_AVANT_LANCEMENT, useLot, type Reglages } from './useLot.ts';

interface Choix {
  readonly systeme: SystemeDisponible;
  readonly reglages: Reglages;
}

const choisir = (systeme: SystemeDisponible): Choix => ({
  systeme,
  reglages: reglagesParDefaut(systeme.definition),
});

/** Le résumé affiché vient-il exactement des mêmes réglages que le lancement enregistré ? */
const memesReglages = (resume: ResumeDeLot, systeme: string, reference: Lancement): boolean =>
  systeme === reference.systeme &&
  resume.graine === reference.resume.graine &&
  resume.iterations === reference.resume.iterations &&
  JSON.stringify(resume.valeurs) === JSON.stringify(reference.resume.valeurs);

const messageDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));

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
  const [vue, setVue] = useState<'lot' | 'comparaison'>('lot');
  const [selection, setSelection] = useState<readonly number[]>([]);
  /** Lancement rechargé : le prochain résumé des mêmes réglages doit lui être identique. */
  const [reference, setReference] = useState<Lancement | null>(null);
  const [nom, setNom] = useState('');
  const [annonce, setAnnonce] = useState<string | null>(null);
  const historique = useHistorique(api);

  useEffect(() => {
    api.systemes().then(
      (liste) => {
        setSystemes(liste);
        const [premier] = liste;
        if (premier !== undefined) setChoix(choisir(premier));
      },
      (e: unknown) => {
        setErreur(messageDe(e));
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
  const verification =
    reference !== null && resume !== null && memesReglages(resume, choix.systeme.id, reference)
      ? JSON.stringify(resume) === JSON.stringify(reference.resume)
      : null;

  const recharger = (id: number) => {
    api.lancement(id).then(
      (lancement) => {
        const systeme = systemes.find((s) => s.id === lancement.systeme);
        if (systeme === undefined) {
          setAnnonce(`Le système « ${lancement.systeme} » n’est plus disponible.`);
          return;
        }
        const { valeurs, graine, iterations } = lancement.resume;
        setChoix({ systeme, reglages: { valeurs, graine, iterations } });
        setReference(lancement);
        setAnnonce(null);
        setVue('lot');
      },
      (e: unknown) => {
        setAnnonce(messageDe(e));
      },
    );
  };

  const enregistrer = async () => {
    const { graine, iterations, valeurs } = choix.reglages;
    const demande = { systeme: choix.systeme.id, graine, iterations, surcharges: valeurs };
    const enregistre = await historique.enregistrer(demande, nom);
    if (enregistre !== null) {
      setAnnonce(`Lancement enregistré : « ${enregistre.nom} ».`);
      setNom('');
    }
  };
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
          <Historique
            lancements={historique.lancements}
            erreur={historique.erreur}
            selection={selection}
            onBasculer={(id) => {
              setSelection(
                selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id],
              );
            }}
            onRecharger={recharger}
            onSupprimer={(id) => {
              setSelection(selection.filter((s) => s !== id));
              void historique.supprimer(id);
            }}
          />
        </aside>
        <section className="resultats" aria-label="Résultats" aria-busy={lot.enCours}>
          <div className="onglets">
            <button
              type="button"
              aria-pressed={vue === 'lot'}
              onClick={() => {
                setVue('lot');
              }}
            >
              Lot en cours
            </button>
            <button
              type="button"
              aria-pressed={vue === 'comparaison'}
              disabled={selection.length !== 2}
              onClick={() => {
                setVue('comparaison');
              }}
            >
              Comparer A et B
            </button>
          </div>
          {vue === 'comparaison' && selection.length === 2 ? (
            <Comparaison
              key={selection.join('-')}
              api={api}
              idA={elementA(selection, 0)}
              idB={elementA(selection, 1)}
            />
          ) : (
            <>
              <div className="etat-du-lot">
                {resume !== null && (
                  <p>
                    {definition.nom} v{resume.definition.version} ·{' '}
                    {formaterNombre(resume.iterations)} itérations · graine {String(resume.graine)}
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
              <form
                className="enregistrer"
                aria-label="Enregistrer le lancement"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enregistrer();
                }}
              >
                <input
                  aria-label="Nom du lancement"
                  placeholder="Nom (facultatif)"
                  value={nom}
                  onChange={(e) => {
                    setNom(e.target.value);
                  }}
                />
                <button type="submit" disabled={resume === null || lot.enCours}>
                  Enregistrer ce lancement
                </button>
              </form>
              {annonce !== null && <p role="status">{annonce}</p>}
              {verification !== null && reference !== null && (
                <p role="status" className={verification ? 'verifie' : 'probleme'}>
                  {verification
                    ? `Résultat identique à l’enregistrement « ${reference.nom} ».`
                    : `Résultat différent de l’enregistrement « ${reference.nom} » avec les mêmes réglages et la même graine : le système a changé depuis.`}
                </p>
              )}
              <div className={lot.enCours ? 'cartes perime' : 'cartes'}>
                {resume?.mesures.map((mesure) => (
                  <CarteDeMesure key={mesure.mesure.nom} resume={mesure} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
