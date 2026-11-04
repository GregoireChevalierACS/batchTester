import type { EvenementDeLot } from '@batchtester/runner';
import { describe, expect, it } from 'vitest';
import { creerLApi, lireLesLignes, MESSAGE_SERVEUR_INJOIGNABLE } from './api.ts';

const flux = (...morceaux: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controleur) {
      for (const morceau of morceaux) controleur.enqueue(new TextEncoder().encode(morceau));
      controleur.close();
    },
  });

const enJson = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });

/** Faux fetch qui répond toujours la même chose et retient les demandes. */
function fauxFetch(reponse: () => Response | Promise<Response>) {
  const demandes: { url: string; init: RequestInit | undefined }[] = [];
  const chercher: typeof fetch = (url, init) => {
    demandes.push({ url: url instanceof Request ? url.url : url.toString(), init });
    return Promise.resolve(reponse());
  };
  return { chercher, demandes };
}

const DEMANDE = { systeme: 'combat', graine: 42, iterations: 10, surcharges: { pvA: 120 } };

async function lancer(chercher: typeof fetch, signal = new AbortController().signal) {
  const evenements: EvenementDeLot[] = [];
  await creerLApi(chercher).lancer(DEMANDE, (e) => evenements.push(e), signal);
  return evenements;
}

describe('lecture des lignes', () => {
  it('reconstitue les lignes coupées entre deux morceaux et ignore les lignes vides', async () => {
    const lues: unknown[] = [];
    await lireLesLignes(flux('{"a":1}\n{"b"', ':2}\n\n', '{"c":3}'), (v) => lues.push(v));
    expect(lues).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("n'appelle rien pour un flux vide", async () => {
    const lues: unknown[] = [];
    await lireLesLignes(flux(), (v) => lues.push(v));
    expect(lues).toEqual([]);
  });
});

describe('liste des systèmes', () => {
  it('lit la liste renvoyée par le serveur', async () => {
    const liste = [{ id: 'combat', definition: { nom: 'Combat' } }];
    const { chercher, demandes } = fauxFetch(() => enJson(liste));
    expect(await creerLApi(chercher).systemes()).toEqual(liste);
    expect(demandes.map((d) => d.url)).toEqual(['/api/systemes']);
  });

  it("refuse une réponse qui n'est pas une liste de systèmes", async () => {
    for (const corps of [{ id: 'combat' }, [{ id: 'combat' }], [null]]) {
      const { chercher } = fauxFetch(() => enJson(corps));
      await expect(creerLApi(chercher).systemes()).rejects.toThrow(
        'Réponse illisible pour /api/systemes.',
      );
    }
  });

  it("rapporte le message d'erreur du serveur, ou à défaut son statut", async () => {
    const avecMessage = fauxFetch(() => enJson({ message: 'Panne.' }, 500));
    await expect(creerLApi(avecMessage.chercher).systemes()).rejects.toThrow('Panne.');
    const sansCorps = fauxFetch(() => new Response('<html>', { status: 502 }));
    await expect(creerLApi(sansCorps.chercher).systemes()).rejects.toThrow(
      'Le serveur a répondu 502.',
    );
  });
});

describe('lancer un lot', () => {
  it('envoie la demande en JSON et transmet chaque événement du flux', async () => {
    const lignes = [
      { type: 'progression', faites: 5, total: 10 },
      { type: 'inconnu' },
      { type: 'probleme', message: 'boum' },
    ];
    const { chercher, demandes } = fauxFetch(
      () => new Response(flux(lignes.map((l) => JSON.stringify(l)).join('\n'))),
    );
    expect(await lancer(chercher)).toEqual([lignes[0], lignes[2]]);
    expect(demandes[0]).toMatchObject({
      url: '/api/lots',
      init: { method: 'POST', body: JSON.stringify(DEMANDE) },
    });
  });

  it('ignore une ligne qui ne décrit pas un événement', async () => {
    const { chercher } = fauxFetch(() => new Response(flux('3\nnull\n"texte"\n')));
    expect(await lancer(chercher)).toEqual([]);
  });

  it('transforme une réponse en erreur en problème', async () => {
    const { chercher } = fauxFetch(() => enJson({ message: 'Système « x » inconnu.' }, 404));
    expect(await lancer(chercher)).toEqual([
      { type: 'probleme', message: 'Système « x » inconnu.' },
    ]);
  });

  it('transforme une réponse sans corps en problème', async () => {
    const { chercher } = fauxFetch(() => new Response(null, { status: 200 }));
    expect(await lancer(chercher)).toEqual([
      { type: 'probleme', message: 'Le serveur a répondu 200.' },
    ]);
  });

  it('se tait quand la demande a été abandonnée', async () => {
    const annulation = new AbortController();
    annulation.abort();
    const chercher: typeof fetch = () => Promise.reject(new DOMException('abandon', 'AbortError'));
    expect(await lancer(chercher, annulation.signal)).toEqual([]);
  });

  it('explique un serveur injoignable, ou toute autre panne', async () => {
    const injoignable: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await lancer(injoignable)).toEqual([
      { type: 'probleme', message: MESSAGE_SERVEUR_INJOIGNABLE },
    ]);
    const flux_casse = fauxFetch(() => new Response(flux('{pas du json}\n')));
    const [probleme] = await lancer(flux_casse.chercher);
    expect(probleme?.type === 'probleme' && probleme.message).toMatch(/^SyntaxError/);
  });
});

describe('historique', () => {
  const APERCU = { id: 1, nom: 'essai', systeme: 'combat' };

  it('liste, lit, enregistre et supprime des lancements', async () => {
    const reponses = [enJson([APERCU]), enJson({ ...APERCU, resume: {} }), enJson(APERCU, 201)];
    const { chercher, demandes } = fauxFetch(
      () => reponses.shift() ?? new Response(null, { status: 204 }),
    );
    const api = creerLApi(chercher);
    expect(await api.lancements()).toEqual([APERCU]);
    expect(await api.lancement(1)).toEqual({ ...APERCU, resume: {} });
    expect(await api.enregistrer(DEMANDE, 'essai')).toEqual(APERCU);
    await api.supprimer(1);
    expect(demandes.map((d) => [d.url, d.init?.method ?? 'GET'])).toEqual([
      ['/api/lancements', 'GET'],
      ['/api/lancements/1', 'GET'],
      ['/api/lancements', 'POST'],
      ['/api/lancements/1', 'DELETE'],
    ]);
    expect(demandes[2]?.init?.body).toBe(JSON.stringify({ ...DEMANDE, nom: 'essai' }));
  });

  it('refuse des réponses illisibles', async () => {
    const api = creerLApi(fauxFetch(() => enJson([{ id: 1 }])).chercher);
    await expect(api.lancements()).rejects.toThrow('Réponse illisible pour /api/lancements.');
    const sansResume = creerLApi(fauxFetch(() => enJson(APERCU)).chercher);
    await expect(sansResume.lancement(1)).rejects.toThrow(
      'Réponse illisible pour /api/lancements/1.',
    );
    const vide = creerLApi(fauxFetch(() => enJson(null, 201)).chercher);
    await expect(vide.enregistrer(DEMANDE, '')).rejects.toThrow(
      'Réponse illisible pour /api/lancements.',
    );
  });

  it('rapporte le message du serveur quand une suppression échoue', async () => {
    const api = creerLApi(
      fauxFetch(() => enJson({ message: 'Lancement n° 9 introuvable.' }, 404)).chercher,
    );
    await expect(api.supprimer(9)).rejects.toThrow('Lancement n° 9 introuvable.');
  });
});
