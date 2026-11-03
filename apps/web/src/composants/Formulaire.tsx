import {
  GRAINE_MAXIMALE,
  valeursParDefaut,
  type DefEntier,
  type DefinitionDeSysteme,
  type DefParametre,
  type ValeurDeParametre,
} from '@batchtester/core';
import { ITERATIONS_MAXIMALES } from '@batchtester/runner';
import { useId } from 'react';
import type { Reglages } from '../useLot.ts';
import { ChampNumerique } from './ChampNumerique.tsx';

const ITERATIONS: DefEntier = {
  kind: 'entier',
  nom: 'iterations',
  libelle: 'Itérations',
  min: 1,
  max: ITERATIONS_MAXIMALES,
  defaut: 200,
};

const GRAINE: DefEntier = {
  kind: 'entier',
  nom: 'graine',
  libelle: 'Graine',
  min: 0,
  max: GRAINE_MAXIMALE,
  defaut: 1,
};

export const reglagesParDefaut = (definition: DefinitionDeSysteme): Reglages => ({
  valeurs: valeursParDefaut(definition.parametres),
  graine: GRAINE.defaut,
  iterations: ITERATIONS.defaut,
});

interface ChampProps {
  readonly def: DefParametre;
  readonly valeur: ValeurDeParametre | undefined;
  readonly onChange: (valeur: ValeurDeParametre) => void;
}

function ChampDeParametre({ def, valeur, onChange }: ChampProps) {
  const id = useId();
  const libelle = def.libelle ?? def.nom;
  switch (def.kind) {
    case 'nombre':
    case 'entier':
      return <ChampNumerique def={def} valeur={Number(valeur)} onChange={onChange} curseur />;
    case 'choix':
      return (
        <div className="champ">
          <label htmlFor={id}>{libelle}</label>
          <select
            id={id}
            value={String(valeur)}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          >
            {def.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    case 'booleen':
      return (
        <div className="champ champ-case">
          <input
            id={id}
            type="checkbox"
            checked={valeur === true}
            onChange={(e) => {
              onChange(e.target.checked);
            }}
          />
          <label htmlFor={id}>{libelle}</label>
        </div>
      );
  }
}

interface Proprietes {
  readonly definition: DefinitionDeSysteme;
  readonly reglages: Reglages;
  readonly onChange: (reglages: Reglages) => void;
  readonly tirerUneGraine: () => number;
}

/** Réglages générés depuis la définition du système : chaque modification relance le lot. */
export function Formulaire({ definition, reglages, onChange, tirerUneGraine }: Proprietes) {
  const changer = (modification: Partial<Reglages>) => {
    onChange({ ...reglages, ...modification });
  };
  return (
    <form
      aria-label="Réglages"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <fieldset>
        <legend>Lot</legend>
        <ChampNumerique
          def={ITERATIONS}
          valeur={reglages.iterations}
          curseur={false}
          onChange={(iterations) => {
            changer({ iterations });
          }}
        />
        <ChampNumerique
          def={GRAINE}
          valeur={reglages.graine}
          curseur={false}
          onChange={(graine) => {
            changer({ graine });
          }}
        />
        <button
          type="button"
          onClick={() => {
            changer({ graine: tirerUneGraine() });
          }}
        >
          Tirer une graine
        </button>
      </fieldset>
      <fieldset>
        <legend>Paramètres</legend>
        {definition.parametres.map((def) => (
          <ChampDeParametre
            key={def.nom}
            def={def}
            valeur={reglages.valeurs[def.nom]}
            onChange={(valeur) => {
              changer({ valeurs: { ...reglages.valeurs, [def.nom]: valeur } });
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            changer({ valeurs: valeursParDefaut(definition.parametres) });
          }}
        >
          Valeurs par défaut
        </button>
      </fieldset>
    </form>
  );
}
