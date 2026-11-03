import { lireUneValeur, type DefEntier, type DefNombre } from '@batchtester/core';
import { useId, useState } from 'react';
import { formaterNombre } from '../format.ts';

interface Proprietes {
  readonly def: DefNombre | DefEntier;
  readonly valeur: number;
  readonly onChange: (valeur: number) => void;
  /** Ajoute un curseur, synchronisé avec le champ texte. */
  readonly curseur: boolean;
}

const pasDe = (def: DefNombre | DefEntier): number => (def.kind === 'nombre' ? def.pas : 1);

/**
 * Champ texte numérique, avec curseur si demandé. Une saisie en cours (« 1 » avant « 12 », champ
 * vidé) reste affichée sans être transmise : seule une valeur valide relance le lot.
 */
export function ChampNumerique({ def, valeur, onChange, curseur }: Proprietes) {
  const id = useId();
  const [texte, setTexte] = useState(String(valeur));
  const [valeurAffichee, setValeurAffichee] = useState(valeur);
  // La valeur a changé ailleurs (curseur, valeurs par défaut) : le texte suit.
  if (valeur !== valeurAffichee) {
    setValeurAffichee(valeur);
    setTexte(String(valeur));
  }

  const estValide = (saisie: string) =>
    saisie.trim() !== '' && lireUneValeur(def, Number(saisie)).ok;
  const libelle = def.libelle ?? def.nom;
  const aide = `De ${formaterNombre(def.min)} à ${formaterNombre(def.max)}${
    def.kind === 'nombre' ? `, par pas de ${formaterNombre(def.pas)}` : ''
  }.`;
  const invalide = !estValide(texte);

  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <div className="champ-saisie">
        {curseur && (
          <input
            type="range"
            aria-label={`${libelle} (curseur)`}
            min={def.min}
            max={def.max}
            step={pasDe(def)}
            value={valeur}
            onChange={(e) => {
              onChange(Number(e.target.value));
            }}
          />
        )}
        <input
          id={id}
          type="number"
          min={def.min}
          max={def.max}
          step={pasDe(def)}
          value={texte}
          aria-invalid={invalide}
          aria-describedby={`${id}-aide`}
          onChange={(e) => {
            setTexte(e.target.value);
            if (estValide(e.target.value)) onChange(Number(e.target.value));
          }}
        />
      </div>
      <small id={`${id}-aide`} className={invalide ? 'aide invalide' : 'aide'}>
        {aide}
      </small>
    </div>
  );
}
