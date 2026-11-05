// Programme externe de test : parle le protocole des systèmes externes (ADR 0003) sur
// stdin/stdout. Son premier argument choisit son comportement :
//   correct  : pile ou face, hasard tiré de la graine reçue (rejoue la même suite)
//   erreur   : répond une erreur quand lancers vaut 3
//   muet     : s'arrête aussitôt, en écrivant sur sa sortie d'erreur
//   illisible: annonce autre chose qu'une définition
//   endormi  : n'annonce jamais rien
//   sourd    : annonce sa définition, puis ne répond jamais
//   plante   : annonce sa définition, puis s'arrête à la première demande
//   tetu     : comme correct, mais ignore la fin de son entrée (il faut l'arrêter)
//   lent     : répond, mais après 300 ms
//   bavard   : comme correct, mais écrit une trace (pas du JSON) avant chaque réponse
// En mode erreur, lancers = 4 donne une erreur qui n'est pas un texte.
import { createInterface } from 'node:readline';

const mode = process.argv[2] ?? 'correct';

const DEFINITION = {
  nom: 'Pile ou face externe',
  version: '1.0.0',
  parametres: [{ kind: 'entier', nom: 'lancers', min: 1, max: 10, defaut: 3 }],
  mesures: [
    { kind: 'nombre', nom: 'piles' },
    { kind: 'categorie', nom: 'issue', categories: ['pile', 'face'] },
    { kind: 'serie', nom: 'cumul' },
  ],
};

// mulberry32 : petit générateur déterministe, initialisé par la graine reçue.
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simuler(valeurs, graine) {
  const tirer = aleatoire(graine);
  const cumul = [];
  let piles = 0;
  for (let i = 0; i < valeurs.lancers; i += 1) {
    if (tirer() < 0.5) piles += 1;
    cumul.push(piles);
  }
  return { piles, issue: piles * 2 >= valeurs.lancers ? 'pile' : 'face', cumul };
}

const ecrire = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

if (mode === 'muet') {
  process.stderr.write('configuration absente');
  process.exit(3);
}
if (mode === 'illisible') ecrire({ bonjour: true });
if (mode === 'endormi' || mode === 'tetu') setInterval(() => undefined, 1000);
if (mode !== 'endormi') ecrire({ definition: DEFINITION });

createInterface({ input: process.stdin }).on('line', (ligne) => {
  const { id, valeurs, graine } = JSON.parse(ligne);
  if (mode === 'sourd') return;
  if (mode === 'plante') {
    process.stderr.write('plantage');
    process.exit(1);
  }
  if (mode === 'bavard') process.stdout.write(`trace : demande ${String(id)}\n`);
  if (mode === 'lent') setTimeout(() => ecrire({ id, resultat: simuler(valeurs, graine) }), 300);
  else if (mode === 'erreur' && valeurs.lancers === 3)
    ecrire({ id, erreur: 'trois lancers interdits' });
  else if (mode === 'erreur' && valeurs.lancers === 4) ecrire({ id, erreur: { code: 4 } });
  else ecrire({ id, resultat: simuler(valeurs, graine) });
});
