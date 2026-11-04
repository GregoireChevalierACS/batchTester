import { DatabaseSync } from 'node:sqlite';
import {
  apercuDe,
  type ApercuDeLancement,
  type Historique,
  type Lancement,
  type LancementAEnregistrer,
  type ResumeDeLot,
} from '@batchtester/runner';

const SCHEMA = `
  create table if not exists lancements (
    id integer primary key autoincrement,
    date text not null,
    systeme text not null,
    nom text not null,
    -- Ce que montre la liste, sans relire le résumé complet de chaque lancement.
    apercu text not null,
    resume text not null
  )
`;

type Ligne = Record<string, unknown>;

/** La base est écrite par ce module seul : une valeur inattendue veut dire qu'elle est abîmée. */
function lire<T>(ligne: Ligne, colonne: string, estValide: (v: unknown) => v is T): T {
  const valeur = ligne[colonne];
  if (!estValide(valeur)) throw new Error(`historique abîmé : colonne « ${colonne} » illisible`);
  return valeur;
}

const estUnTexte = (v: unknown): v is string => typeof v === 'string';
const estUnNombre = (v: unknown): v is number => typeof v === 'number';
const estUnObjet = (v: unknown): v is object => typeof v === 'object' && v !== null;

// Le JSON relu a été écrit à partir de ces types : on vérifie qu'il s'agit bien d'un objet,
// sans revalider chaque champ d'un résumé que ce module a lui-même sérialisé.
const estUnResume = (v: unknown): v is ResumeDeLot => estUnObjet(v);
const estUnApercu = (v: unknown): v is Omit<ApercuDeLancement, 'id' | 'date' | 'systeme' | 'nom'> =>
  estUnObjet(v);

function relire<T>(ligne: Ligne, colonne: string, estValide: (v: unknown) => v is T): T {
  const valeur: unknown = JSON.parse(lire(ligne, colonne, estUnTexte));
  return lire({ [colonne]: valeur }, colonne, estValide);
}

const lancementDe = (ligne: Ligne): Lancement => ({
  id: lire(ligne, 'id', estUnNombre),
  date: lire(ligne, 'date', estUnTexte),
  systeme: lire(ligne, 'systeme', estUnTexte),
  nom: lire(ligne, 'nom', estUnTexte),
  resume: relire(ligne, 'resume', estUnResume),
});

const apercuDeLaLigne = (ligne: Ligne): ApercuDeLancement => ({
  ...relire(ligne, 'apercu', estUnApercu),
  id: lire(ligne, 'id', estUnNombre),
  date: lire(ligne, 'date', estUnTexte),
  systeme: lire(ligne, 'systeme', estUnTexte),
  nom: lire(ligne, 'nom', estUnTexte),
});

export interface HistoriqueSqlite extends Historique {
  fermer(): void;
}

/** Historique dans un fichier SQLite (« :memory: » pour une base éphémère). */
export function ouvrirLHistorique(
  chemin: string,
  maintenant: () => Date = () => new Date(),
): HistoriqueSqlite {
  const base = new DatabaseSync(chemin);
  base.exec(SCHEMA);
  const inserer = base.prepare(
    'insert into lancements (date, systeme, nom, apercu, resume) values (?, ?, ?, ?, ?)',
  );
  const lister = base.prepare(
    'select id, date, systeme, nom, apercu from lancements order by id desc',
  );
  const lireUn = base.prepare('select id, date, systeme, nom, resume from lancements where id = ?');
  const supprimer = base.prepare('delete from lancements where id = ?');

  return {
    enregistrer({ systeme, nom, resume }: LancementAEnregistrer): Lancement {
      const date = maintenant().toISOString();
      const { nomDuSysteme, version, graine, iterations, valeurs } = apercuDe({
        id: 0,
        date,
        systeme,
        nom,
        resume,
      });
      const apercu = JSON.stringify({ nomDuSysteme, version, graine, iterations, valeurs });
      const { lastInsertRowid } = inserer.run(date, systeme, nom, apercu, JSON.stringify(resume));
      return { id: Number(lastInsertRowid), date, systeme, nom, resume };
    },
    lister: () => lister.all().map(apercuDeLaLigne),
    lire: (id) => {
      const ligne = lireUn.get(id);
      return ligne === undefined ? null : lancementDe(ligne);
    },
    supprimer: (id) => Number(supprimer.run(id).changes) > 0,
    fermer: () => {
      base.close();
    },
  };
}
