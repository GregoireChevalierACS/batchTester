import { systemeTypeScript, type SystemeDecouvert } from '@batchtester/adapters';
import { HistoriqueEnMemoire } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import combat from '../../../systemes/combat/src/index.ts';
import { creerLeServeur } from './serveur.ts';

const SYSTEMES: SystemeDecouvert[] = [{ id: 'combat', ...systemeTypeScript(combat) }];
const serveur = () => creerLeServeur({ systemes: SYSTEMES, historique: new HistoriqueEnMemoire() });

const balayage = (corps: Record<string, unknown> = {}) => ({
  method: 'POST' as const,
  url: '/api/balayages',
  payload: {
    systeme: 'combat',
    graine: 42,
    iterations: 50,
    surcharges: { pvB: 100 },
    axes: [{ parametre: 'pvA', valeurs: [80, 100, 120] }],
    ...corps,
  },
});

const lire = (corps: string): unknown[] =>
  corps
    .trim()
    .split('\n')
    .map((ligne): unknown => JSON.parse(ligne));

describe('balayages', () => {
  it('envoie la progression sur tous les points, puis le balayage', async () => {
    const reponse = await serveur().inject(balayage());
    expect(reponse.headers['content-type']).toBe('application/x-ndjson; charset=utf-8');
    const evenements = lire(reponse.body);
    const progressions = evenements.slice(0, -1);
    expect(progressions).toHaveLength(75);
    expect(progressions.at(-1)).toEqual({ type: 'progression', faites: 150, total: 150 });
    expect(evenements.at(-1)).toMatchObject({
      type: 'balayage',
      balayage: {
        graine: 42,
        iterations: 50,
        axes: [{ parametre: 'pvA', valeurs: [80, 100, 120] }],
        points: [
          { valeurs: [80], resume: { valeurs: { pvA: 80, pvB: 100 } } },
          { valeurs: [100] },
          { valeurs: [120] },
        ],
      },
    });
  });

  it('balaye une grille de deux paramètres, valeurs non numériques comprises', async () => {
    const reponse = await serveur().inject(
      balayage({
        axes: [
          { parametre: 'pvA', valeurs: [80, 120] },
          { parametre: 'initiative', valeurs: ['A', 'B'] },
        ],
      }),
    );
    expect(lire(reponse.body).at(-1)).toMatchObject({
      type: 'balayage',
      balayage: {
        points: [
          { valeurs: [80, 'A'] },
          { valeurs: [80, 'B'] },
          { valeurs: [120, 'A'] },
          { valeurs: [120, 'B'] },
        ],
      },
    });
  });

  it('explique un balayage refusé dans le flux', async () => {
    const reponse = await serveur().inject(
      balayage({ axes: [{ parametre: 'pvA', valeurs: [0] }] }),
    );
    expect(lire(reponse.body)).toEqual([
      { type: 'probleme', message: '« pvA » = 0 : hors des bornes.' },
    ]);
  });

  it('refuse un système inconnu ou une demande mal formée', async () => {
    expect((await serveur().inject(balayage({ systeme: 'tcg' }))).statusCode).toBe(404);
    expect((await serveur().inject(balayage({ axes: 'pvA' }))).statusCode).toBe(400);
    expect((await serveur().inject(balayage({ axes: [{ parametre: 'pvA' }] }))).statusCode).toBe(
      400,
    );
  });
});

describe('annulation d’un balayage', () => {
  it('arrête le balayage quand le navigateur abandonne la demande', async () => {
    let appels = 0;
    const lent = {
      definition: {
        nom: 'Lent',
        version: '1',
        parametres: [{ kind: 'entier' as const, nom: 'x', min: 1, max: 10, defaut: 1 }],
        mesures: [{ kind: 'nombre' as const, nom: 'y' }],
      },
      simuler: () => {
        appels += 1;
        const fin = performance.now() + 1;
        while (performance.now() < fin);
        return { y: 1 };
      },
    };
    const ouvert = creerLeServeur({
      systemes: [{ id: 'lent', ...systemeTypeScript(lent) }],
      historique: new HistoriqueEnMemoire(),
    });
    try {
      const adresse = await ouvert.listen({ host: '127.0.0.1', port: 0 });
      const controleur = new AbortController();
      const reponse = await fetch(`${adresse}/api/balayages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systeme: 'lent',
          graine: 1,
          iterations: 1000,
          surcharges: {},
          axes: [{ parametre: 'x', valeurs: [1, 2, 3, 4, 5] }],
        }),
        signal: controleur.signal,
      });
      await reponse.body?.getReader().read();
      controleur.abort();
      // Même processus que le client, bloqué 1 ms par itération : la fermeture se voit en retard.
      await new Promise((resolve) => setTimeout(resolve, 800));
      const apresAnnulation = appels;
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(appels).toBe(apresAnnulation);
      expect(appels).toBeLessThan(5000);
    } finally {
      await ouvert.close();
    }
  });
});
