import {
  elementA,
  err,
  ok,
  POINTS_MAXIMAUX_PAR_AXE,
  valeursEchelonnees,
  valeursPossibles,
  type DefParametre,
  type Result,
  type ValeurDeParametre,
} from '@batchtester/core';
import {
  indicateursDuBalayage,
  POINTS_MAXIMAUX_PAR_BALAYAGE,
  type AxeDeBalayage,
} from '@batchtester/runner';
import { useId, useMemo, useState } from 'react';
import type { Api, SystemeDisponible } from '../api.ts';
import { formaterNombre } from '../format.ts';
import {
  decrireUnPoint,
  optionDeGrille,
  optionDUnAxe,
  valeurLisible,
} from '../graphiquesDeBalayage.ts';
import { useTheme } from '../theme.ts';
import { useBalayage } from '../useBalayage.ts';
import type { Reglages } from '../useLot.ts';
import { Graphique } from './Graphique.tsx';

interface ReglageDAxe {
  readonly parametre: string;
  readonly de: string;
  readonly a: string;
  readonly points: string;
}

/** Un paramètre numérique se balaye sur une plage ; un choix ou un booléen, sur toutes ses valeurs. */
function reglageParDefaut(def: DefParametre, points: number): ReglageDAxe {
  return def.kind === 'nombre' || def.kind === 'entier'
    ? { parametre: def.nom, de: String(def.min), a: String(def.max), points: String(points) }
    : { parametre: def.nom, de: '', a: '', points: '' };
}

/** Le paramètre nommé ; un axe le choisit toujours dans la liste des paramètres du système. */
const parametreNomme = (defs: readonly DefParametre[], nom: string): DefParametre =>
  elementA(
    defs,
    Math.max(
      0,
      defs.findIndex((d) => d.nom === nom),
    ),
  );

/** Texte saisi en nombre ; un champ vide n'est pas zéro. */
const lu = (texte: string): number => (texte.trim() === '' ? Number.NaN : Number(texte));

function valeursDeLAxe(
  defs: readonly DefParametre[],
  reglage: ReglageDAxe,
): Result<readonly ValeurDeParametre[], string> {
  const def = parametreNomme(defs, reglage.parametre);
  if (def.kind === 'choix' || def.kind === 'booleen') return ok(valeursPossibles(def));
  const valeurs = valeursEchelonnees(def, lu(reglage.de), lu(reglage.a), lu(reglage.points));
  if (valeurs.ok) return valeurs;
  return err(
    valeurs.error.kind === 'points-invalides'
      ? `« ${def.libelle ?? def.nom} » : de 1 à ${String(POINTS_MAXIMAUX_PAR_AXE)} points.`
      : `« ${def.libelle ?? def.nom} » : la plage doit rester entre ${formaterNombre(def.min)} et ${formaterNombre(def.max)}.`,
  );
}

function ChampDAxe({
  titre,
  defs,
  reglage,
  onChange,
}: {
  titre: string;
  defs: readonly DefParametre[];
  reglage: ReglageDAxe;
  onChange: (reglage: ReglageDAxe) => void;
}) {
  const id = useId();
  const def = parametreNomme(defs, reglage.parametre);
  const champ = (cle: 'de' | 'a' | 'points', libelle: string) => (
    <label className="champ">
      {libelle}
      <input
        type="number"
        value={reglage[cle]}
        onChange={(e) => {
          onChange({ ...reglage, [cle]: e.target.value });
        }}
      />
    </label>
  );
  return (
    <fieldset>
      <legend>{titre}</legend>
      <label htmlFor={id}>Paramètre</label>
      <select
        id={id}
        value={reglage.parametre}
        onChange={(e) => {
          onChange(
            reglageParDefaut(elementA(defs, e.target.selectedIndex), Number(reglage.points) || 11),
          );
        }}
      >
        {defs.map((d) => (
          <option key={d.nom} value={d.nom}>
            {d.libelle ?? d.nom}
          </option>
        ))}
      </select>
      {def.kind === 'nombre' || def.kind === 'entier' ? (
        <div className="champs-d-axe">
          {champ('de', 'De')}
          {champ('a', 'À')}
          {champ('points', 'Points')}
        </div>
      ) : (
        <p className="aide">Toutes les valeurs possibles sont essayées.</p>
      )}
    </fieldset>
  );
}

interface Proprietes {
  readonly api: Api;
  readonly systeme: SystemeDisponible;
  /** Réglages communs à tous les points, et graine. */
  readonly reglages: Reglages;
}

/** Un ou deux paramètres balayés, tout le reste aux réglages du lot en cours. */
export function Balayage({ api, systeme, reglages }: Proprietes) {
  const theme = useTheme();
  const defs = systeme.definition.parametres;
  const idIterations = useId();
  const idIndicateur = useId();
  const [premier, setPremier] = useState(() => reglageParDefaut(elementA(defs, 0), 11));
  const [second, setSecond] = useState<ReglageDAxe | null>(null);
  const [iterations, setIterations] = useState('100');
  const [indicateurChoisi, setIndicateurChoisi] = useState(0);
  const balayage = useBalayage(api);

  const reglagesDAxes = second === null ? [premier] : [premier, second];
  const lus = reglagesDAxes.map((r) => valeursDeLAxe(defs, r));
  const axes: AxeDeBalayage[] = lus.flatMap((v, i) =>
    v.ok ? [{ parametre: elementA(reglagesDAxes, i).parametre, valeurs: v.value }] : [],
  );
  const points = axes.reduce((produit, axe) => produit * axe.valeurs.length, 1);
  const iterationsLues = lu(iterations);
  const erreurs = [
    ...lus.flatMap((v) => (v.ok ? [] : [v.error])),
    ...(second !== null && second.parametre === premier.parametre
      ? ['Choisir deux paramètres différents.']
      : []),
    ...(axes.length === reglagesDAxes.length && points > POINTS_MAXIMAUX_PAR_BALAYAGE
      ? [`${String(points)} points : au plus ${String(POINTS_MAXIMAUX_PAR_BALAYAGE)}.`]
      : []),
    ...(Number.isInteger(iterationsLues) && iterationsLues >= 1
      ? []
      : ['Le nombre d’itérations par point doit être un entier positif.']),
  ];

  const resultat = balayage.balayage;
  const indicateurs = useMemo(
    () => (resultat === null ? [] : indicateursDuBalayage(resultat)),
    [resultat],
  );
  // Un nouveau balayage peut avoir moins d'indicateurs : le choix reste dans la liste.
  const indicateur = indicateurs.at(Math.min(indicateurChoisi, indicateurs.length - 1));
  const option = useMemo(() => {
    if (resultat === null || indicateur === undefined) return null;
    const [x, y] = resultat.axes;
    return y === undefined || x === undefined
      ? optionDUnAxe(elementA(resultat.axes, 0), indicateur, theme)
      : optionDeGrille([x, y], indicateur, theme);
  }, [resultat, indicateur, theme]);

  return (
    <section className="balayage" aria-label="Balayage">
      <form
        aria-label="Réglages du balayage"
        onSubmit={(e) => {
          e.preventDefault();
          balayage.lancer({
            systeme: systeme.id,
            graine: reglages.graine,
            iterations: iterationsLues,
            surcharges: reglages.valeurs,
            axes,
          });
        }}
      >
        <div className="axes">
          <ChampDAxe
            titre="Premier paramètre"
            defs={defs}
            reglage={premier}
            onChange={setPremier}
          />
          {second !== null && (
            <ChampDAxe titre="Second paramètre" defs={defs} reglage={second} onChange={setSecond} />
          )}
        </div>
        <label className="champ-case">
          <input
            type="checkbox"
            checked={second !== null}
            onChange={(e) => {
              // Un autre paramètre que le premier, s'il en existe un.
              const autre = elementA(
                defs,
                Math.max(
                  0,
                  defs.findIndex((d) => d.nom !== premier.parametre),
                ),
              );
              setSecond(e.target.checked ? reglageParDefaut(autre, 6) : null);
            }}
          />
          Croiser avec un second paramètre (grille)
        </label>
        <div className="champ">
          <label htmlFor={idIterations}>Itérations par point</label>
          <input
            id={idIterations}
            type="number"
            min={1}
            value={iterations}
            onChange={(e) => {
              setIterations(e.target.value);
            }}
          />
        </div>
        {erreurs.length > 0 ? (
          <ul className="erreurs" aria-label="À corriger">
            {erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="aide">
            {String(points)} points × {formaterNombre(iterationsLues)} itérations ={' '}
            {formaterNombre(points * iterationsLues)} itérations. Chaque point rejoue la graine{' '}
            {String(reglages.graine)} : les écarts viennent des réglages, pas du hasard.
          </p>
        )}
        <div className="actions">
          <button type="submit" disabled={erreurs.length > 0 || balayage.enCours}>
            Lancer le balayage
          </button>
          {balayage.enCours && (
            <button type="button" onClick={balayage.annuler}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {balayage.enCours && (
        <progress
          aria-label="Avancement du balayage"
          max={balayage.progression?.total ?? 1}
          value={balayage.progression?.faites ?? 0}
        />
      )}
      {balayage.probleme !== null && (
        <p role="alert" className="probleme">
          {balayage.probleme}
        </p>
      )}

      {resultat !== null && indicateur !== undefined && option !== null && (
        <article className="carte" aria-label="Résultat du balayage">
          <h2>
            {resultat.axes.map((a) => a.parametre).join(' × ')} · {String(resultat.points.length)}{' '}
            points de {formaterNombre(resultat.iterations)} itérations · graine{' '}
            {String(resultat.graine)}
          </h2>
          <label htmlFor={idIndicateur}>Indicateur</label>
          <select
            id={idIndicateur}
            value={String(indicateurs.indexOf(indicateur))}
            onChange={(e) => {
              setIndicateurChoisi(Number(e.target.value));
            }}
          >
            {indicateurs.map((ind, i) => (
              <option key={ind.id} value={String(i)}>
                {ind.libelle}
              </option>
            ))}
          </select>
          <Graphique titre={indicateur.libelle} option={option} hauteur={320} />
          <details className="donnees">
            <summary>Données</summary>
            <table className="tableau">
              <thead>
                <tr>
                  {resultat.axes.map((a) => (
                    <th key={a.parametre} scope="col">
                      {a.parametre}
                    </th>
                  ))}
                  <th scope="col">{indicateur.libelle}</th>
                </tr>
              </thead>
              <tbody>
                {resultat.points.map((p, k) => (
                  <tr key={p.valeurs.map(String).join('|')}>
                    {p.valeurs.map((v, i) => (
                      <td key={elementA(resultat.axes, i).parametre}>{valeurLisible(v)}</td>
                    ))}
                    <td>{decrireUnPoint(indicateur, elementA(indicateur.valeurs, k))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </article>
      )}
    </section>
  );
}
