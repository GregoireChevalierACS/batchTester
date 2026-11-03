import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AIDE } from './arguments.ts';
import { executer, SORTIE_ECHEC, SORTIE_OK, SORTIE_USAGE } from './executer.ts';

const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
const COMBAT = 'systemes/combat/src/index.ts';

async function lancer(...argv: string[]) {
  const sortie: string[] = [];
  const erreurs: string[] = [];
  const code = await executer(argv, RACINE, {
    ecrire: (texte) => sortie.push(texte),
    ecrireErreur: (texte) => erreurs.push(texte),
  });
  return { code, sortie: sortie.join(''), erreurs: erreurs.join('') };
}

describe('ligne de commande', () => {
  it('donne deux fois exactement le même rapport avec la même graine', async () => {
    const premier = await lancer(COMBAT, '-n', '200', '-g', '42');
    const second = await lancer(COMBAT, '-n', '200', '-g', '42');
    expect(premier).toMatchObject({ code: SORTIE_OK, erreurs: '' });
    expect(premier.sortie).toContain(
      'Combat 1 contre 1 — version 1.0.0\n200 itérations · graine 42',
    );
    expect(second.sortie).toBe(premier.sortie);
  });

  it('donne un autre rapport avec une autre graine', async () => {
    const premier = await lancer(COMBAT, '-g', '1');
    const autre = await lancer(COMBAT, '-g', '2');
    expect(autre.sortie).not.toBe(premier.sortie);
  });

  it('applique les paramètres saisis', async () => {
    const { sortie } = await lancer(COMBAT, '-n', '20', '-p', 'pvA=250', '-p', 'precisionB=0,5');
    expect(sortie).toMatch(/pvA +250 +PV de A/);
    expect(sortie).toMatch(/precisionB +0,5 +Précision de B/);
  });

  it('ne dépend pas du nombre de simulations simultanées', async () => {
    const seule = await lancer(COMBAT, '-n', '50', '--simultanees', '1');
    const plusieurs = await lancer(COMBAT, '-n', '50', '--simultanees', '16');
    expect(plusieurs.sortie).toBe(seule.sortie);
  });

  it('écrit le résumé complet en JSON', async () => {
    const { code, sortie } = await lancer(COMBAT, '-n', '10', '-g', '3', '--json');
    expect(code).toBe(SORTIE_OK);
    const resume: unknown = JSON.parse(sortie);
    expect(resume).toMatchObject({
      graine: 3,
      iterations: 10,
      definition: { nom: 'Combat 1 contre 1' },
    });
  });

  it("affiche l'aide", async () => {
    expect(await lancer('--aide')).toEqual({ code: SORTIE_OK, sortie: AIDE, erreurs: '' });
  });

  it("explique une erreur d'usage, suivie de l'aide", async () => {
    expect(await lancer()).toEqual({
      code: SORTIE_USAGE,
      sortie: '',
      erreurs: `Indiquer le chemin du système à simuler.\n\n${AIDE}`,
    });
  });

  it('explique un système impossible à charger', async () => {
    const { code, erreurs } = await lancer('apps/cli/fixtures/pasUnSysteme.ts');
    expect(code).toBe(SORTIE_ECHEC);
    expect(erreurs).toBe(
      "« apps/cli/fixtures/pasUnSysteme.ts » n'exporte pas de système par défaut (definition et simuler).\n",
    );
  });

  it('explique un lot refusé', async () => {
    const { code, sortie, erreurs } = await lancer(COMBAT, '-p', 'pvA=0');
    expect({ code, sortie }).toEqual({ code: SORTIE_ECHEC, sortie: '' });
    expect(erreurs).toBe('Valeurs de paramètres invalides :\n  - « pvA » = 0 : hors des bornes\n');
  });
});
