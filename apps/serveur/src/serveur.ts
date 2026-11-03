import fastifyStatic from '@fastify/static';
import {
  simulateurEnMemoire,
  simulateurQuiCede,
  type SystemeDecouvert,
} from '@batchtester/adapters';
import { creerGraine } from '@batchtester/core';
import {
  expliquerUnProblemeDeLot,
  lancerUnLot,
  resumerLeLot,
  type DemandeDeLotADistance,
  type EvenementDeLot,
} from '@batchtester/runner';
import Fastify, { type FastifyInstance } from 'fastify';

export interface OptionsDuServeur {
  readonly systemes: readonly SystemeDecouvert[];
  /** Interface construite (apps/web/dist). Absente en développement, où Vite la sert. */
  readonly dossierWeb?: string;
}

/** Au plus une centaine de progressions par lot : assez pour une barre fluide. */
export const PROGRESSIONS_PAR_LOT = 100;

// Les bornes fines (graine sur 32 bits, nombre d'itérations, valeurs des paramètres) sont
// vérifiées par le noyau et le runner, qui expliquent chaque refus.
const SCHEMA_DE_DEMANDE = {
  type: 'object',
  required: ['systeme', 'graine', 'iterations', 'surcharges'],
  properties: {
    systeme: { type: 'string' },
    graine: { type: 'integer' },
    iterations: { type: 'integer' },
    surcharges: { type: 'object' },
  },
} as const;

export function creerLeServeur({ systemes, dossierWeb }: OptionsDuServeur): FastifyInstance {
  const app = Fastify();
  const parId = new Map(systemes.map(({ id, systeme }) => [id, systeme]));

  app.get('/api/systemes', () =>
    systemes.map(({ id, systeme }) => ({ id, definition: systeme.definition })),
  );

  app.post<{ Body: DemandeDeLotADistance }>(
    '/api/lots',
    { schema: { body: SCHEMA_DE_DEMANDE } },
    async (requete, reponse) => {
      const { systeme: id, iterations, surcharges } = requete.body;
      const systeme = parId.get(id);
      if (systeme === undefined) {
        return reponse.code(404).send({ message: `Système « ${id} » inconnu.` });
      }
      const graine = creerGraine(requete.body.graine);
      if (!graine.ok) {
        return reponse.code(400).send({ message: 'La graine doit aller de 0 à 4294967295.' });
      }

      // La réponse part au fil du lot : Fastify n'y touche plus.
      reponse.hijack();
      const flux = reponse.raw;
      // Le navigateur abandonne la demande quand un réglage change : le lot s'arrête aussitôt.
      const annulation = new AbortController();
      flux.on('close', () => {
        annulation.abort();
      });
      flux.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
      });
      const ecrire = (evenement: EvenementDeLot) => flux.write(`${JSON.stringify(evenement)}\n`);

      const pas = Math.max(1, Math.ceil(iterations / PROGRESSIONS_PAR_LOT));
      const lot = await lancerUnLot(
        simulateurQuiCede(simulateurEnMemoire(systeme)),
        { surcharges, graine: graine.value, iterations },
        {
          signal: annulation.signal,
          surProgression: (faites, total) => {
            if (faites % pas === 0 || faites === total)
              ecrire({ type: 'progression', faites, total });
          },
        },
      );
      if (lot.ok) ecrire({ type: 'resume', resume: resumerLeLot(lot.value) });
      // Annulé : personne n'écoute plus, il n'y a rien à écrire.
      else if (lot.error.kind !== 'lot-annule') {
        ecrire({ type: 'probleme', message: expliquerUnProblemeDeLot(lot.error) });
      }
      flux.end();
      return reponse;
    },
  );

  if (dossierWeb !== undefined) void app.register(fastifyStatic, { root: dossierWeb });
  return app;
}
