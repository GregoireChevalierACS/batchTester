import type { ResumeDeMesure } from '@batchtester/runner';
import { useMemo, type ReactNode } from 'react';
import { formaterNombre, formaterPourcentage, titreDeMesure as titreDe } from '../format.ts';
import {
  etiquetteDeClasse,
  optionDeConvergence,
  optionDeConvergenceDesCategories,
  optionDeLaSerie,
  optionDeLHistogramme,
  optionDesFrequences,
} from '../graphiques.ts';
import { useTheme } from '../theme.ts';
import { Graphique } from './Graphique.tsx';

type ResumeDe<K extends ResumeDeMesure['kind']> = Extract<ResumeDeMesure, { kind: K }>;

/** Les valeurs de chaque graphique, lisibles sans couleur ni survol. */
function Donnees({
  entetes,
  lignes,
}: {
  entetes: readonly string[];
  lignes: readonly (readonly string[])[];
}) {
  return (
    <details className="donnees">
      <summary>Données</summary>
      <table>
        <thead>
          <tr>
            {entetes.map((entete) => (
              <th key={entete} scope="col">
                {entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            // Les lignes ne bougent qu'avec un nouveau résumé : leur rang suffit comme clé.
            <tr key={i}>
              {ligne.map((cellule, j) => (
                <td key={entetes[j]}>{cellule}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Carte({ titre, vide, children }: { titre: string; vide: boolean; children: ReactNode }) {
  return (
    <article className="carte" aria-label={titre}>
      <h2>{titre}</h2>
      {vide ? <p className="vide">Aucune valeur dans ce lot.</p> : children}
    </article>
  );
}

function CarteDeCategorie({ resume }: { resume: ResumeDe<'categorie'> }) {
  const theme = useTheme();
  const titre = titreDe(resume.mesure);
  const taux = useMemo(() => optionDesFrequences(resume.frequences, theme), [resume, theme]);
  const convergence = useMemo(
    () => optionDeConvergenceDesCategories(resume.convergence, theme),
    [resume, theme],
  );
  return (
    <Carte titre={titre} vide={resume.frequences.length === 0}>
      <Graphique
        titre={`${titre} : taux et intervalle de confiance à 95 %`}
        option={taux}
        hauteur={48 + 36 * resume.frequences.length}
      />
      <Graphique titre={`${titre} : convergence du taux`} option={convergence} hauteur={200} />
      <Donnees
        entetes={['Catégorie', 'Effectif', 'Taux', 'IC 95 %']}
        lignes={resume.frequences.map((f) => [
          f.categorie,
          String(f.effectif),
          formaterPourcentage(f.proportion),
          `${formaterPourcentage(f.basse)} – ${formaterPourcentage(f.haute)}`,
        ])}
      />
    </Carte>
  );
}

function CarteDeNombre({ resume }: { resume: ResumeDe<'nombre'> }) {
  const theme = useTheme();
  const titre = titreDe(resume.mesure);
  const { classes, discret } = resume.histogramme;
  const distribution = useMemo(
    () => optionDeLHistogramme(classes, discret, theme),
    [classes, discret, theme],
  );
  const convergence = useMemo(
    () => optionDeConvergence(resume.convergence, theme),
    [resume, theme],
  );
  const r = resume.resume;
  const f = formaterNombre;
  return (
    <Carte titre={titre} vide={r === null}>
      {r !== null && (
        <dl className="tuiles">
          {[
            ['Moyenne', f(r.moyenne)],
            ['Écart-type', f(r.ecartType)],
            ['Médiane', f(r.mediane)],
            ['P5 – P95', `${f(r.p5)} – ${f(r.p95)}`],
            ['Min – max', `${f(r.min)} – ${f(r.max)}`],
          ].map(([libelle, valeur]) => (
            <div className="tuile" key={libelle}>
              <dt>{libelle}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      <Graphique titre={`${titre} : distribution`} option={distribution} />
      <Graphique
        titre={`${titre} : convergence de la moyenne`}
        option={convergence}
        hauteur={200}
      />
      <Donnees
        entetes={['Classe', 'Itérations']}
        lignes={classes.map((c) => [etiquetteDeClasse(c, discret), String(c.effectif)])}
      />
    </Carte>
  );
}

function CarteDeSerie({ resume }: { resume: ResumeDe<'serie'> }) {
  const theme = useTheme();
  const titre = titreDe(resume.mesure);
  const serie = useMemo(() => optionDeLaSerie(resume.points, theme), [resume, theme]);
  return (
    <Carte titre={titre} vide={resume.points.length === 0}>
      <Graphique titre={`${titre} : moyenne et min – max par tour`} option={serie} />
      <Donnees
        entetes={['Tour', 'Moyenne', 'Min', 'Max', 'Itérations']}
        lignes={resume.points.map((p) => [
          String(p.indice),
          formaterNombre(p.moyenne),
          formaterNombre(p.min),
          formaterNombre(p.max),
          String(p.n),
        ])}
      />
    </Carte>
  );
}

/** Graphiques et tableau d'une mesure, selon sa sorte. */
export function CarteDeMesure({ resume }: { resume: ResumeDeMesure }) {
  switch (resume.kind) {
    case 'categorie':
      return <CarteDeCategorie resume={resume} />;
    case 'nombre':
      return <CarteDeNombre resume={resume} />;
    case 'serie':
      return <CarteDeSerie resume={resume} />;
  }
}
