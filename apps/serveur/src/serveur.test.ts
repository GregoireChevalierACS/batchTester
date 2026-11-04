import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SystemeDecouvert } from '@batchtester/adapters';
import type { Systeme } from '@batchtester/core';

import { HistoriqueEnMemoire } from '@batchtester/runner/testing';
import { afterEach, describe, expect, it } from 'vitest';
import combat from '../../../systemes/combat/src/index.ts';
import { creerLeServeur, PROGRESSIONS_PAR_LOT } from './serveur.ts';

const SYSTEMES: SystemeDecouvert[] = [{ id: 'combat', systeme: combat }];

const lire = (corps: string): unknown[] =>
  corps
    .trim()
    .split('\n')
    .map((ligne): unknown => JSON.parse(ligne));

const progressionsDe = (corps: string) =>
  lire(corps).filter((e) => typeof e === 'object' && e !== null && 'faites' in e);

const demande = (corps: Record<string, unknown>) => ({
  method: 'POST' as const,
  url: '/api/lots',
  payload: { systeme: 'combat', graine: 42, iterations: 200, surcharges: {}, ...corps },
});

describe('liste des systèmes', () => {
  it('donne chaque système avec sa définition', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject('/api/systemes');
    expect(reponse.statusCode).toBe(200);
    const definition: unknown = JSON.parse(JSON.stringify(combat.definition));
    expect(reponse.json()).toEqual([{ id: 'combat', definition }]);
  });
});

describe('lancer un lot', () => {
  it('envoie la progression au fil du lot, puis le résumé', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject(demande({}));
    expect(reponse.statusCode).toBe(200);
    expect(reponse.headers['content-type']).toBe('application/x-ndjson; charset=utf-8');
    const progressions = progressionsDe(reponse.body);
    expect(progressions).toHaveLength(PROGRESSIONS_PAR_LOT);
    expect(progressions[0]).toEqual({ type: 'progression', faites: 2, total: 200 });
    expect(progressions.at(-1)).toEqual({ type: 'progression', faites: 200, total: 200 });
    expect(lire(reponse.body).at(-1)).toMatchObject({
      type: 'resume',
      resume: { graine: 42, iterations: 200 },
    });
  });

  it('signale aussi la dernière itération quand le pas ne tombe pas juste', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject(demande({ iterations: 150 }));
    expect(progressionsDe(reponse.body).slice(-2)).toMatchObject([
      { faites: 148 },
      { faites: 150 },
    ]);
  });

  it('donne le même résumé pour la même graine', async () => {
    const serveur = creerLeServeur({ systemes: SYSTEMES, historique: new HistoriqueEnMemoire() });
    const premier = lire((await serveur.inject(demande({}))).body).at(-1);
    const second = lire((await serveur.inject(demande({}))).body).at(-1);
    expect(second).toEqual(premier);
  });

  it('explique un lot refusé dans le flux', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject(demande({ surcharges: { pvA: 0 } }));
    expect(lire(reponse.body)).toEqual([
      {
        type: 'probleme',
        message: 'Valeurs de paramètres invalides :\n  - « pvA » = 0 : hors des bornes',
      },
    ]);
  });

  it('refuse un système inconnu', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject(demande({ systeme: 'tcg' }));
    expect(reponse.statusCode).toBe(404);
    expect(reponse.json()).toEqual({ message: 'Système « tcg » inconnu.' });
  });

  it('refuse une graine hors des 32 bits', async () => {
    const reponse = await creerLeServeur({
      systemes: SYSTEMES,
      historique: new HistoriqueEnMemoire(),
    }).inject(demande({ graine: -1 }));
    expect(reponse.statusCode).toBe(400);
    expect(reponse.json()).toEqual({ message: 'La graine doit aller de 0 à 4294967295.' });
  });

  it.each([{ graine: 'abc' }, { iterations: 2.5 }, { surcharges: 'pvA=3' }])(
    'refuse une demande mal formée (%j)',
    async (corps) => {
      const reponse = await creerLeServeur({
        systemes: SYSTEMES,
        historique: new HistoriqueEnMemoire(),
      }).inject(demande(corps));
      expect(reponse.statusCode).toBe(400);
    },
  );
});

describe('annulation', () => {
  let ouvert: ReturnType<typeof creerLeServeur> | undefined;
  afterEach(async () => {
    await ouvert?.close();
  });

  it('arrête le lot quand le navigateur abandonne la demande', async () => {
    let appels = 0;
    const lent: Systeme = {
      definition: {
        nom: 'Lent',
        version: '1',
        parametres: [],
        mesures: [{ kind: 'nombre', nom: 'x' }],
      },
      simuler: () => {
        appels += 1;
        const fin = performance.now() + 1;
        while (performance.now() < fin);
        return { x: 1 };
      },
    };
    ouvert = creerLeServeur({
      systemes: [{ id: 'lent', systeme: lent }],
      historique: new HistoriqueEnMemoire(),
    });
    const adresse = await ouvert.listen({ host: '127.0.0.1', port: 0 });
    const controleur = new AbortController();
    const reponse = await fetch(`${adresse}/api/lots`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systeme: 'lent', graine: 1, iterations: 5000, surcharges: {} }),
      signal: controleur.signal,
    });
    const lecteur = reponse.body?.getReader();
    await lecteur?.read();
    controleur.abort();
    // Client et serveur partagent ce processus, que le système bloque 1 ms par itération : la
    // fermeture met quelques centaines de millisecondes à être vue. Ensuite, plus rien ne tourne.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const apresAnnulation = appels;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(appels).toBe(apresAnnulation);
    expect(appels).toBeLessThan(5000);
  });
});

describe("fichiers de l'interface", () => {
  it("sert l'interface construite quand elle existe", async () => {
    const dossier = await mkdtemp(join(tmpdir(), 'batchtester-web-'));
    try {
      await writeFile(join(dossier, 'index.html'), '<!doctype html><title>batchTester</title>');
      const serveur = creerLeServeur({
        systemes: SYSTEMES,
        historique: new HistoriqueEnMemoire(),
        dossierWeb: dossier,
      });
      const reponse = await serveur.inject('/');
      expect(reponse.statusCode).toBe(200);
      expect(reponse.body).toContain('<title>batchTester</title>');
    } finally {
      await rm(dossier, { recursive: true });
    }
  });

  it("ne sert rien d'autre que l'API sans interface construite", async () => {
    expect(
      (
        await creerLeServeur({ systemes: SYSTEMES, historique: new HistoriqueEnMemoire() }).inject(
          '/',
        )
      ).statusCode,
    ).toBe(404);
  });
});
