// Format des commits : « yyyy-mm-dd # N : (type) message »
// N est le numéro du commit dans la journée. La date doit être celle du commit (DATE_DU_COMMIT,
// fournie par scripts/verifier-commits.mjs en CI) ou, à défaut, la date du jour (hook commit-msg).

const TYPES = ['feat', 'fix', 'test', 'refactor', 'build', 'ci', 'docs', 'chore', 'perf', 'revert'];

const FORMAT = /^(\d{4}-\d{2}-\d{2}) # ([1-9]\d*) : \(([a-z]+)\) (\S.*)$/;

/** Date locale au format yyyy-mm-dd (toISOString donnerait la date UTC). */
function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return `${String(maintenant.getFullYear())}-${mois}-${jour}`;
}

function estUneDateValide(texte) {
  const date = new Date(`${texte}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(texte);
}

/** @type {import('@commitlint/types').UserConfig} */
export default {
  // Le format maison ne suit pas Conventional Commits : on ne charge aucune règle par défaut et
  // un analyseur qui ne reconnaît rien, pour que seules les règles ci-dessous s'appliquent.
  parserPreset: { parserOpts: { headerPattern: /^$/ } },
  plugins: [
    {
      rules: {
        'format-journal': ({ header }) => [
          FORMAT.test(header ?? ''),
          'le titre doit suivre « yyyy-mm-dd # N : (type) message », par exemple « 2026-10-31 # 1 : (build) initialisation du dépôt »',
        ],
        'type-connu': ({ header }) => {
          const type = FORMAT.exec(header ?? '')?.[3];
          return [
            type === undefined || TYPES.includes(type),
            `type inconnu, attendu : ${TYPES.join(', ')}`,
          ];
        },
        'date-reelle': ({ header }) => {
          const date = FORMAT.exec(header ?? '')?.[1];
          if (date === undefined) return [true];
          if (!estUneDateValide(date)) return [false, `${date} n'est pas une date valide`];
          const attendue = process.env.DATE_DU_COMMIT ?? dateDuJour();
          return [
            date === attendue,
            `la date du message (${date}) doit être celle du commit (${attendue})`,
          ];
        },
      },
    },
  ],
  rules: {
    'format-journal': [2, 'always'],
    'type-connu': [2, 'always'],
    'date-reelle': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
  },
};
