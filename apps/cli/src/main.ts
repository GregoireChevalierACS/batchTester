import { executer } from './executer.ts';

process.exitCode = await executer(process.argv.slice(2), process.cwd(), {
  ecrire: (texte) => process.stdout.write(texte),
  ecrireErreur: (texte) => process.stderr.write(texte),
});
