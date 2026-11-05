import { fileURLToPath } from 'node:url';
import { lancerUnLot } from '@batchtester/runner';
import { graine, verifierLeContratDuSimulateur } from '@batchtester/runner/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DELAI_PAR_DEFAUT,
  demarrerUnSimulateurExterne,
  expliquerUnProblemeDExterne,
  type SimulateurExterne,
} from './simulateurExterne.ts';

const PROGRAMME = fileURLToPath(new URL('../fixtures/externes/programme.mjs', import.meta.url));
const REPERTOIRE = fileURLToPath(new URL('..', import.meta.url));

const ouverts: SimulateurExterne[] = [];
afterEach(async () => {
  await Promise.all(ouverts.splice(0).map((s) => s.fermer()));
});

/** Lance le programme de test dans le mode demandé (voir fixtures/externes/programme.mjs). */
async function demarrer(mode: string, delai?: number) {
  const demarre = await demarrerUnSimulateurExterne(process.execPath, [PROGRAMME, mode], {
    repertoire: REPERTOIRE,
    ...(delai === undefined ? {} : { delai }),
  });
  if (demarre.ok) ouverts.push(demarre.value);
  return demarre;
}

async function pret(mode: string, delai?: number): Promise<SimulateurExterne> {
  const demarre = await demarrer(mode, delai);
  if (!demarre.ok) throw new Error(expliquerUnProblemeDExterne(demarre.error));
  return demarre.value;
}

verifierLeContratDuSimulateur('programme externe', () => pret('correct'));

describe('simulateur externe', () => {
  it('reçoit la définition annoncée par le programme', async () => {
    const simulateur = await pret('correct');
    expect(simulateur.definition.nom).toBe('Pile ou face externe');
  });

  it('confie chaque itération au programme et rend son résultat', async () => {
    const simulateur = await pret('correct');
    const resultat = await simulateur.simuler({ lancers: 4 }, graine(42));
    expect(resultat).toEqual({ piles: 1, issue: 'face', cumul: [0, 1, 1, 1] });
  });

  it('mène plusieurs itérations à la fois, chacune avec sa réponse', async () => {
    const simulateur = await pret('correct');
    const lot = await lancerUnLot(
      simulateur,
      { surcharges: { lancers: 6 }, graine: graine(7), iterations: 40 },
      { simultanees: 8 },
    );
    expect(lot.ok && lot.value.iterations).toHaveLength(40);
  });

  it("transmet l'erreur d'une itération au runner", async () => {
    const simulateur = await pret('erreur');
    const lot = await lancerUnLot(simulateur, {
      surcharges: { lancers: 3 },
      graine: graine(1),
      iterations: 2,
    });
    expect(!lot.ok && lot.error).toMatchObject({
      kind: 'simulation-en-echec',
      message: 'trois lancers interdits',
    });
  });

  it("rapporte tel quel une erreur qui n'est pas un texte", async () => {
    const simulateur = await pret('erreur');
    await expect(simulateur.simuler({ lancers: 4 }, graine(1))).rejects.toThrow('{"code":4}');
  });

  it('ignore les lignes du programme qui ne sont pas du JSON', async () => {
    const simulateur = await pret('bavard');
    expect(await simulateur.simuler({ lancers: 4 }, graine(42))).toEqual({
      piles: 1,
      issue: 'face',
      cumul: [0, 1, 1, 1],
    });
  });

  it('fait échouer une itération sans réponse, et ignore une réponse arrivée trop tard', async () => {
    const simulateur = await pret('lent', 100);
    await expect(simulateur.simuler({ lancers: 2 }, graine(1))).rejects.toThrow(
      'pas de réponse en 100 ms',
    );
    // La réponse tardive (300 ms) arrive pour une itération déjà abandonnée : elle est ignorée.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(simulateur.simuler({ lancers: 2 }, graine(1))).rejects.toThrow('pas de réponse');
  });

  it("fait échouer les itérations en cours quand le programme s'arrête, puis les suivantes", async () => {
    const simulateur = await pret('plante');
    await expect(simulateur.simuler({ lancers: 2 }, graine(1))).rejects.toThrow(
      "le programme s'est arrêté (code 1) : plantage",
    );
    await expect(simulateur.simuler({ lancers: 2 }, graine(2))).rejects.toThrow(
      "le programme s'est arrêté (code 1)",
    );
  });

  it('se ferme proprement, et arrête un programme qui ne se termine pas seul', async () => {
    const poli = await pret('correct');
    await poli.fermer();
    await expect(poli.simuler({ lancers: 1 }, graine(1))).rejects.toThrow(/s'est arrêté/u);
    const tetu = await pret('tetu', 200);
    await tetu.fermer();
    await expect(tetu.simuler({ lancers: 1 }, graine(1))).rejects.toThrow(/s'est arrêté/u);
  });

  it('attend 10 secondes par défaut', () => {
    expect(DELAI_PAR_DEFAUT).toBe(10_000);
  });
});

describe('démarrage impossible', () => {
  it('signale une commande introuvable', async () => {
    const demarre = await demarrerUnSimulateurExterne('commande-qui-n-existe-pas', [], {
      repertoire: REPERTOIRE,
    });
    expect(!demarre.ok && demarre.error).toMatchObject({
      kind: 'lancement-impossible',
      commande: 'commande-qui-n-existe-pas',
    });
  });

  it("signale un programme qui s'arrête sans définition, avec sa sortie d'erreur", async () => {
    expect(await demarrer('muet')).toEqual({
      ok: false,
      error: {
        kind: 'definition-absente',
        commande: process.execPath,
        message: "le programme s'est arrêté (code 3) : configuration absente",
      },
    });
  });

  it("signale un programme qui n'annonce rien à temps", async () => {
    expect(await demarrer('endormi', 200)).toEqual({
      ok: false,
      error: {
        kind: 'definition-absente',
        commande: process.execPath,
        message: 'aucune définition reçue en 200 ms',
      },
    });
  });

  it('signale une première ligne qui n’est pas une définition', async () => {
    expect(await demarrer('illisible')).toEqual({
      ok: false,
      error: {
        kind: 'definition-illisible',
        commande: process.execPath,
        ligne: '{"bonjour":true}',
      },
    });
  });
});

describe('explications', () => {
  it.each([
    [
      { kind: 'lancement-impossible' as const, commande: 'python', message: 'spawn python ENOENT' },
      'Impossible de lancer « python » : spawn python ENOENT',
    ],
    [
      { kind: 'definition-absente' as const, commande: 'python', message: 'code 1' },
      "« python » n'a pas annoncé sa définition : code 1",
    ],
    [
      { kind: 'definition-illisible' as const, commande: 'python', ligne: 'bonjour' },
      '« python » a annoncé une définition illisible : bonjour',
    ],
  ])('%j', (probleme, message) => {
    expect(expliquerUnProblemeDExterne(probleme)).toBe(message);
  });
});
