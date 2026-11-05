import { systemeTypeScript, type SystemeDecouvert } from '@batchtester/adapters';
import { HistoriqueEnMemoire } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import combat from '../../../systemes/combat/src/index.ts';
import { creerLeServeur } from './serveur.ts';

const SYSTEMES: SystemeDecouvert[] = [{ id: 'combat', ...systemeTypeScript(combat) }];

function preparer() {
  const historique = new HistoriqueEnMemoire();
  return { historique, serveur: creerLeServeur({ systemes: SYSTEMES, historique }) };
}

const enregistrement = (corps: Record<string, unknown> = {}) => ({
  method: 'POST' as const,
  url: '/api/lancements',
  payload: { systeme: 'combat', graine: 42, iterations: 100, surcharges: { pvA: 130 }, ...corps },
});

/** Le dernier événement du flux de /api/lots : le résumé du lot. */
async function resumeDuLot(serveur: ReturnType<typeof creerLeServeur>) {
  const reponse = await serveur.inject({
    method: 'POST',
    url: '/api/lots',
    payload: { systeme: 'combat', graine: 42, iterations: 100, surcharges: { pvA: 130 } },
  });
  const dernier: unknown = JSON.parse(reponse.body.trim().split('\n').at(-1) ?? 'null');
  return dernier;
}

describe('enregistrer un lancement', () => {
  it('rejoue le lot, le garde et renvoie son aperçu', async () => {
    const { historique, serveur } = preparer();
    const reponse = await serveur.inject(enregistrement({ nom: '  PV de A à 130  ' }));
    expect(reponse.statusCode).toBe(201);
    expect(reponse.json()).toMatchObject({
      id: 1,
      systeme: 'combat',
      nom: 'PV de A à 130',
      nomDuSysteme: 'Combat 1 contre 1',
      version: '1.0.0',
      graine: 42,
      iterations: 100,
      valeurs: { pvA: 130, pvB: 120 },
    });
    // Le résumé enregistré est exactement celui qu'aurait affiché l'interface.
    expect({ type: 'resume', resume: historique.lire(1)?.resume }).toEqual(
      await resumeDuLot(serveur),
    );
  });

  it('nomme le lancement par ses réglages quand aucun nom n’est donné', async () => {
    const { serveur } = preparer();
    const sansNom = await serveur.inject(enregistrement());
    const nomVide = await serveur.inject(enregistrement({ nom: '   ' }));
    for (const reponse of [sansNom, nomVide]) {
      expect(reponse.json<{ nom: string }>().nom).toMatch(/^graine 42 · pvA=130, degatsA=12, /u);
    }
  });

  it('refuse un système inconnu, une graine invalide ou un lot refusé, sans rien enregistrer', async () => {
    const { historique, serveur } = preparer();
    const inconnu = await serveur.inject(enregistrement({ systeme: 'tcg' }));
    const graine = await serveur.inject(enregistrement({ graine: -1 }));
    const refuse = await serveur.inject(enregistrement({ surcharges: { pvA: 0 } }));
    expect([inconnu.statusCode, graine.statusCode, refuse.statusCode]).toEqual([404, 400, 400]);
    expect(refuse.json()).toEqual({
      message: 'Valeurs de paramètres invalides :\n  - « pvA » = 0 : hors des bornes',
    });
    expect(historique.lister()).toEqual([]);
  });
});

describe('consulter l’historique', () => {
  it('liste les lancements du plus récent au plus ancien', async () => {
    const { serveur } = preparer();
    await serveur.inject(enregistrement({ nom: 'premier' }));
    await serveur.inject(enregistrement({ nom: 'second', graine: 7 }));
    const reponse = await serveur.inject('/api/lancements');
    expect(reponse.json<{ nom: string }[]>().map((l) => l.nom)).toEqual(['second', 'premier']);
  });

  it('rend un lancement complet, ou dit qu’il est introuvable', async () => {
    const { historique, serveur } = preparer();
    await serveur.inject(enregistrement());
    const trouve = await serveur.inject('/api/lancements/1');
    expect(trouve.json()).toEqual(JSON.parse(JSON.stringify(historique.lire(1))));
    const absent = await serveur.inject('/api/lancements/9');
    expect(absent.statusCode).toBe(404);
    expect(absent.json()).toEqual({ message: 'Lancement n° 9 introuvable.' });
    expect((await serveur.inject('/api/lancements/abc')).statusCode).toBe(400);
  });

  it('supprime un lancement', async () => {
    const { historique, serveur } = preparer();
    await serveur.inject(enregistrement());
    const supprime = await serveur.inject({ method: 'DELETE', url: '/api/lancements/1' });
    expect(supprime.statusCode).toBe(204);
    expect(historique.lister()).toEqual([]);
    const encore = await serveur.inject({ method: 'DELETE', url: '/api/lancements/1' });
    expect(encore.statusCode).toBe(404);
  });
});
