import {
  estSignificatif,
  type Ecart,
  type Resume,
  type ValeurDeParametre,
} from '@batchtester/core';
import {
  comparerDeuxLots,
  type Comparaison as ComparaisonDeLots,
  type ComparaisonDeMesure,
  type Lancement,
} from '@batchtester/runner';
import { useEffect, useMemo, useState } from 'react';
import type { Api } from '../api.ts';
import {
  formaterEcart,
  formaterNombre,
  formaterPourcentage,
  titreDeMesure as titreDe,
} from '../format.ts';
import {
  LOTS,
  optionDeComparaisonDesMoyennes,
  optionDeComparaisonDesSeries,
  optionDeComparaisonDesTaux,
} from '../graphiques.ts';
import { useTheme } from '../theme.ts';
import { Graphique } from './Graphique.tsx';

type Chargement =
  | { readonly etat: 'en-cours' }
  | { readonly etat: 'pret'; readonly a: Lancement; readonly b: Lancement }
  | { readonly etat: 'erreur'; readonly message: string };

const valeurLisible = (v: ValeurDeParametre | undefined): string => {
  if (v === undefined) return '—';
  if (typeof v === 'number') return formaterNombre(v);
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return v;
};

/** « +4,5 pts [+0,2 ; +8,8] · significatif » : l'écart, son intervalle et ce qu'il permet de dire. */
const ecartLisible = (ecart: Ecart, enPoints: boolean): string => {
  const f = (x: number) => (enPoints ? `${formaterEcart(x * 100)} pts` : formaterEcart(x));
  const verdict = estSignificatif(ecart) ? 'significatif' : 'non significatif';
  return `${f(ecart.ecart)} [${f(ecart.basse)} ; ${f(ecart.haute)}] · ${verdict}`;
};

function Tableau({
  entetes,
  lignes,
}: {
  entetes: readonly string[];
  lignes: readonly (readonly string[])[];
}) {
  return (
    <table className="tableau">
      <thead>
        <tr>
          {entetes.map((e) => (
            <th key={e} scope="col">
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((ligne, i) => (
          // Les lignes ne bougent qu'avec une nouvelle comparaison : leur rang suffit comme clé.
          <tr key={i}>
            {ligne.map((cellule, j) => (
              <td key={entetes[j]}>{cellule}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const statistiques = (r: Resume | null): string[] =>
  r === null
    ? ['—', '—', '—', '—']
    : [
        formaterNombre(r.moyenne),
        formaterNombre(r.ecartType),
        formaterNombre(r.mediane),
        `${formaterNombre(r.p5)} – ${formaterNombre(r.p95)}`,
      ];

function CarteDeComparaison({ comparee }: { comparee: ComparaisonDeMesure }) {
  const theme = useTheme();
  const titre = titreDe(comparee.mesure);
  const option = useMemo(() => {
    switch (comparee.kind) {
      case 'categorie':
        return optionDeComparaisonDesTaux(comparee.categories, theme);
      case 'nombre':
        return optionDeComparaisonDesMoyennes(comparee.a, comparee.b, theme);
      case 'serie':
        return optionDeComparaisonDesSeries(comparee.a, comparee.b, theme);
    }
  }, [comparee, theme]);

  return (
    <article className="carte" aria-label={titre}>
      <h2>{titre}</h2>
      {comparee.kind === 'categorie' && (
        <>
          <Graphique
            titre={`${titre} : taux de A et de B`}
            option={option}
            hauteur={56 + 44 * comparee.categories.length}
          />
          <Tableau
            entetes={['Catégorie', 'A', 'B', 'Écart B − A [IC 95 %]']}
            lignes={comparee.categories.map((c) => [
              c.categorie,
              c.a === null ? '—' : formaterPourcentage(c.a.proportion),
              c.b === null ? '—' : formaterPourcentage(c.b.proportion),
              c.ecart === null ? '—' : ecartLisible(c.ecart, true),
            ])}
          />
        </>
      )}
      {comparee.kind === 'nombre' && (
        <>
          <Graphique
            titre={`${titre} : moyenne de A et de B, IC 95 %`}
            option={option}
            hauteur={120}
          />
          <Tableau
            entetes={['Lot', 'Moyenne', 'Écart-type', 'Médiane', 'P5 – P95']}
            lignes={[
              ['A', ...statistiques(comparee.a)],
              ['B', ...statistiques(comparee.b)],
            ]}
          />
          <p className="ecart">
            Écart des moyennes B − A :{' '}
            {comparee.ecart === null ? 'non calculable' : ecartLisible(comparee.ecart, false)}
          </p>
        </>
      )}
      {comparee.kind === 'serie' && (
        <Graphique titre={`${titre} : moyenne par tour de A et de B`} option={option} />
      )}
    </article>
  );
}

function VueDeComparaison({
  a,
  b,
  comparaison,
}: {
  a: Lancement;
  b: Lancement;
  comparaison: ComparaisonDeLots;
}) {
  return (
    <>
      <dl className="lots-compares">
        {[a, b].map((l, rang) => (
          <div key={l.id}>
            <dt>
              <span className={`pastille pastille-${String(rang)}`} aria-hidden="true" />
              {LOTS[rang]}
            </dt>
            <dd>
              {l.nom} — {l.resume.definition.nom} v{l.resume.definition.version}, graine{' '}
              {String(l.resume.graine)}, {formaterNombre(l.resume.iterations)} itérations
            </dd>
          </div>
        ))}
      </dl>
      {!comparaison.memeVersion && (
        <p role="note" className="probleme">
          Les deux lancements ne viennent pas de la même version du système : les écarts mêlent
          l’effet des réglages et celui des règles.
        </p>
      )}
      <article className="carte" aria-label="Paramètres comparés">
        <h2>Paramètres</h2>
        <Tableau
          entetes={['Paramètre', 'A', 'B', '']}
          lignes={comparaison.parametres.map((p) => [
            p.libelle ?? p.nom,
            valeurLisible(p.a),
            valeurLisible(p.b),
            p.different ? 'modifié' : '',
          ])}
        />
      </article>
      <div className="cartes">
        {comparaison.mesures.map((m) => (
          <CarteDeComparaison key={m.mesure.nom} comparee={m} />
        ))}
      </div>
      {comparaison.sansEquivalent.length > 0 && (
        <p className="aide">
          Non comparées (absentes d’un des lots, ou de sorte différente) :{' '}
          {comparaison.sansEquivalent.join(', ')}.
        </p>
      )}
    </>
  );
}

/** Deux lancements enregistrés côte à côte : réglages, puis chaque mesure et son écart. */
export function Comparaison({ api, idA, idB }: { api: Api; idA: number; idB: number }) {
  const [chargement, setChargement] = useState<Chargement>({ etat: 'en-cours' });

  useEffect(() => {
    Promise.all([api.lancement(idA), api.lancement(idB)]).then(
      ([a, b]) => {
        setChargement({ etat: 'pret', a, b });
      },
      (e: unknown) => {
        setChargement({ etat: 'erreur', message: e instanceof Error ? e.message : String(e) });
      },
    );
  }, [api, idA, idB]);

  const comparaison = useMemo(
    () =>
      chargement.etat === 'pret'
        ? comparerDeuxLots(chargement.a.resume, chargement.b.resume)
        : null,
    [chargement],
  );

  if (chargement.etat === 'erreur') {
    return (
      <p role="alert" className="probleme">
        Comparaison impossible : {chargement.message}
      </p>
    );
  }
  if (chargement.etat === 'en-cours' || comparaison === null)
    return <p>Chargement des lancements…</p>;
  return <VueDeComparaison a={chargement.a} b={chargement.b} comparaison={comparaison} />;
}
