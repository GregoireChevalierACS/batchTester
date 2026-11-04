import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decouvrirLesSystemes,
  expliquerUnProblemeDeChargement,
  ouvrirLHistorique,
} from '@batchtester/adapters';
import { creerLeServeur } from './serveur.ts';

const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
const DOSSIER_WEB = join(RACINE, 'apps', 'web', 'dist');
const PORT = Number(process.env['PORT'] ?? 5174);
// Données locales, hors du dépôt (donnees/ est ignoré par git).
const HISTORIQUE =
  process.env['BATCHTESTER_HISTORIQUE'] ?? join(RACINE, 'donnees', 'historique.sqlite');

const { systemes, problemes } = await decouvrirLesSystemes(join(RACINE, 'systemes'));
for (const probleme of problemes) console.error(expliquerUnProblemeDeChargement(probleme));

mkdirSync(dirname(HISTORIQUE), { recursive: true });
const historique = ouvrirLHistorique(HISTORIQUE);

const app = creerLeServeur({
  systemes,
  historique,
  ...(existsSync(DOSSIER_WEB) ? { dossierWeb: DOSSIER_WEB } : {}),
});
app.addHook('onClose', () => {
  historique.fermer();
});
// Uniquement sur la boucle locale : l'outil exécute du code du dépôt, il n'est pas fait pour le réseau.
const adresse = await app.listen({ host: '127.0.0.1', port: PORT });
console.log(`batchTester : ${adresse} (${String(systemes.length)} système(s))`);
console.log(`Historique : ${HISTORIQUE}`);
