import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decouvrirLesSystemes, expliquerUnProblemeDeChargement } from '@batchtester/adapters';
import { creerLeServeur } from './serveur.ts';

const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
const DOSSIER_WEB = join(RACINE, 'apps', 'web', 'dist');
const PORT = Number(process.env['PORT'] ?? 5174);

const { systemes, problemes } = await decouvrirLesSystemes(join(RACINE, 'systemes'));
for (const probleme of problemes) console.error(expliquerUnProblemeDeChargement(probleme));

const app = creerLeServeur({
  systemes,
  ...(existsSync(DOSSIER_WEB) ? { dossierWeb: DOSSIER_WEB } : {}),
});
// Uniquement sur la boucle locale : l'outil exécute du code du dépôt, il n'est pas fait pour le réseau.
const adresse = await app.listen({ host: '127.0.0.1', port: PORT });
console.log(`batchTester : ${adresse} (${String(systemes.length)} système(s))`);
