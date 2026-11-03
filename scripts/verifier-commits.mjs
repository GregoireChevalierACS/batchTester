// Vérifie en CI le format de chaque commit d'une plage, avec la date réelle de chaque commit.
// commitlint seul ne connaît que le message : on lui transmet la date via DATE_DU_COMMIT.
//
// Usage : node scripts/verifier-commits.mjs [depuis] [jusqua]
//   depuis : SHA exclu (absent ou 000… = tout l'historique, cas du premier push)
//   jusqua : SHA inclus (HEAD par défaut)

import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [depuis, jusqua = 'HEAD'] = process.argv.slice(2);
const plage = depuis === undefined || /^0+$/.test(depuis) ? [jusqua] : [`${depuis}..${jusqua}`];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

// %ad au format court s'affiche dans le fuseau du commit : c'est la date « réelle » de l'auteur.
const commits = git('log', '--no-merges', '--format=%H', ...plage)
  .split('\n')
  .filter(Boolean);

const commitlint = createRequire(import.meta.url).resolve('@commitlint/cli/cli.js');
let echecs = 0;

for (const sha of commits) {
  const date = git('show', '-s', '--date=short', '--format=%ad', sha).trim();
  const message = git('show', '-s', '--format=%B', sha);
  const resultat = spawnSync(process.execPath, [commitlint], {
    input: message,
    encoding: 'utf8',
    env: { ...process.env, DATE_DU_COMMIT: date },
  });
  if (resultat.status !== 0) {
    echecs += 1;
    console.error(
      `✖ ${sha.slice(0, 7)} ${message.split('\n')[0] ?? ''}\n${resultat.stdout}${resultat.stderr}`,
    );
  }
}

console.log(`${String(commits.length - echecs)}/${String(commits.length)} commit(s) conforme(s).`);
process.exitCode = echecs === 0 ? 0 : 1;
