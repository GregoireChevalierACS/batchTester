import fastifyStatic from '@fastify/static';
import type { SystemeDecouvert } from '@batchtester/adapters';
import { creerGraine, err, ok, type Graine, type Result } from '@batchtester/core';
import {
  apercuDe,
  expliquerUnProblemeDeBalayage,
  expliquerUnProblemeDeLot,
  lancerUnBalayage,
  lancerUnLot,
  nomParDefaut,
  resumerLeLot,
  type DemandeDeBalayageADistance,
  type DemandeDeLotADistance,
  type EvenementDeBalayage,
  type EvenementDeLot,
  type Historique,
  type OptionsDeLot,
  type Simulateur,
} from '@batchtester/runner';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';

export interface OptionsDuServeur {
  readonly systemes: readonly SystemeDecouvert[];
  readonly historique: Historique;
  /** Interface construite (apps/web/dist). Absente en développement, où Vite la sert. */
  readonly dossierWeb?: string;
}

/** Au plus une centaine de progressions par lot ou balayage : assez pour une barre fluide. */
export const PROGRESSIONS_PAR_LOT = 100;

/**
 * Ouvre une réponse en flux NDJSON (ADR 0002) : Fastify n'y touche plus, et le signal se lève
 * dès que le navigateur abandonne la demande, ce qui arrête le calcul en cours.
 */
function ouvrirUnFlux(reponse: FastifyReply) {
  reponse.hijack();
  const flux = reponse.raw;
  const annulation = new AbortController();
  flux.on('close', () => {
    annulation.abort();
  });
  flux.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
  });
  const ecrire = (evenement: EvenementDeLot | EvenementDeBalayage) =>
    flux.write(`${JSON.stringify(evenement)}\n`);
  return {
    signal: annulation.signal,
    ecrire,
    surProgression: (faites: number, total: number) => {
      const pas = Math.max(1, Math.ceil(total / PROGRESSIONS_PAR_LOT));
      if (faites % pas === 0 || faites === total) ecrire({ type: 'progression', faites, total });
    },
    fermer: () => flux.end(),
  };
}

// Les bornes fines (graine sur 32 bits, nombre d'itérations, valeurs des paramètres) sont
// vérifiées par le noyau et le runner, qui expliquent chaque refus.
const PROPRIETES_D_UNE_DEMANDE = {
  systeme: { type: 'string' },
  graine: { type: 'integer' },
  iterations: { type: 'integer' },
  surcharges: { type: 'object' },
} as const;

const SCHEMA_DE_DEMANDE = {
  type: 'object',
  required: ['systeme', 'graine', 'iterations', 'surcharges'],
  properties: PROPRIETES_D_UNE_DEMANDE,
} as const;

const SCHEMA_D_ENREGISTREMENT = {
  ...SCHEMA_DE_DEMANDE,
  properties: { ...PROPRIETES_D_UNE_DEMANDE, nom: { type: 'string' } },
} as const;

const SCHEMA_DE_BALAYAGE = {
  type: 'object',
  required: ['systeme', 'graine', 'iterations', 'surcharges', 'axes'],
  properties: {
    ...PROPRIETES_D_UNE_DEMANDE,
    axes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['parametre', 'valeurs'],
        properties: {
          parametre: { type: 'string' },
          valeurs: {
            type: 'array',
            items: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] },
          },
        },
      },
    },
  },
} as const;

const SCHEMA_D_IDENTIFIANT = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer' } },
} as const;

interface Refus {
  readonly code: 400 | 404;
  readonly message: string;
}

export function creerLeServeur({
  systemes,
  historique,
  dossierWeb,
}: OptionsDuServeur): FastifyInstance {
  const app = Fastify();
  const parId = new Map(systemes.map((systeme) => [systeme.id, systeme.simulateur]));

  const preparer = (
    demande: DemandeDeLotADistance,
  ): Result<{ simulateur: Simulateur; graine: Graine }, Refus> => {
    const simulateur = parId.get(demande.systeme);
    if (simulateur === undefined) {
      return err({ code: 404, message: `Système « ${demande.systeme} » inconnu.` });
    }
    const graine = creerGraine(demande.graine);
    if (!graine.ok) return err({ code: 400, message: 'La graine doit aller de 0 à 4294967295.' });
    return ok({ simulateur, graine: graine.value });
  };

  const jouer = (
    simulateur: Simulateur,
    graine: Graine,
    demande: DemandeDeLotADistance,
    options: OptionsDeLot = {},
  ) =>
    lancerUnLot(
      simulateur,
      { surcharges: demande.surcharges, graine, iterations: demande.iterations },
      options,
    );

  const introuvable = (id: number): string => `Lancement n° ${String(id)} introuvable.`;

  app.get('/api/systemes', () => systemes.map(({ id, definition }) => ({ id, definition })));

  app.post<{ Body: DemandeDeLotADistance }>(
    '/api/lots',
    { schema: { body: SCHEMA_DE_DEMANDE } },
    async (requete, reponse) => {
      const prepare = preparer(requete.body);
      if (!prepare.ok)
        return reponse.code(prepare.error.code).send({ message: prepare.error.message });

      const { signal, ecrire, surProgression, fermer } = ouvrirUnFlux(reponse);
      const lot = await jouer(prepare.value.simulateur, prepare.value.graine, requete.body, {
        signal,
        surProgression,
      });
      if (lot.ok) ecrire({ type: 'resume', resume: resumerLeLot(lot.value) });
      // Annulé : personne n'écoute plus, il n'y a rien à écrire.
      else if (lot.error.kind !== 'lot-annule') {
        ecrire({ type: 'probleme', message: expliquerUnProblemeDeLot(lot.error) });
      }
      fermer();
      return reponse;
    },
  );

  app.post<{ Body: DemandeDeBalayageADistance }>(
    '/api/balayages',
    { schema: { body: SCHEMA_DE_BALAYAGE } },
    async (requete, reponse) => {
      const prepare = preparer(requete.body);
      if (!prepare.ok)
        return reponse.code(prepare.error.code).send({ message: prepare.error.message });

      const { signal, ecrire, surProgression, fermer } = ouvrirUnFlux(reponse);
      const { surcharges, iterations, axes } = requete.body;
      const balayage = await lancerUnBalayage(
        prepare.value.simulateur,
        { surcharges, graine: prepare.value.graine, iterations, axes },
        { signal, surProgression },
      );
      if (balayage.ok) ecrire({ type: 'balayage', balayage: balayage.value });
      else if (balayage.error.kind !== 'balayage-annule') {
        ecrire({ type: 'probleme', message: expliquerUnProblemeDeBalayage(balayage.error) });
      }
      fermer();
      return reponse;
    },
  );

  app.get('/api/lancements', () => historique.lister());

  app.get<{ Params: { id: number } }>(
    '/api/lancements/:id',
    { schema: { params: SCHEMA_D_IDENTIFIANT } },
    (requete, reponse) => {
      const lancement = historique.lire(requete.params.id);
      if (lancement === null)
        return reponse.code(404).send({ message: introuvable(requete.params.id) });
      return lancement;
    },
  );

  // Le lot est rejoué ici plutôt que reçu de l'interface : un résultat enregistré vient toujours
  // du système lui-même, avec ces réglages et cette graine.
  app.post<{ Body: DemandeDeLotADistance & { nom?: string } }>(
    '/api/lancements',
    { schema: { body: SCHEMA_D_ENREGISTREMENT } },
    async (requete, reponse) => {
      const prepare = preparer(requete.body);
      if (!prepare.ok)
        return reponse.code(prepare.error.code).send({ message: prepare.error.message });
      const lot = await jouer(prepare.value.simulateur, prepare.value.graine, requete.body);
      if (!lot.ok) return reponse.code(400).send({ message: expliquerUnProblemeDeLot(lot.error) });
      const resume = resumerLeLot(lot.value);
      const nom = requete.body.nom?.trim() ?? '';
      const lancement = historique.enregistrer({
        systeme: requete.body.systeme,
        nom: nom === '' ? nomParDefaut(resume) : nom,
        resume,
      });
      return reponse.code(201).send(apercuDe(lancement));
    },
  );

  app.delete<{ Params: { id: number } }>(
    '/api/lancements/:id',
    { schema: { params: SCHEMA_D_IDENTIFIANT } },
    (requete, reponse) => {
      if (!historique.supprimer(requete.params.id)) {
        return reponse.code(404).send({ message: introuvable(requete.params.id) });
      }
      return reponse.code(204).send();
    },
  );

  if (dossierWeb !== undefined) void app.register(fastifyStatic, { root: dossierWeb });
  return app;
}
