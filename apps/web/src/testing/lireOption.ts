// Lecture d'une option ECharts dans les tests, sans conversion de type : les options sont des
// unions profondes, on n'en lit que les morceaux qui portent une décision.

export const champ = (valeur: unknown, nom: string): unknown =>
  typeof valeur === 'object' && valeur !== null
    ? new Map<string, unknown>(Object.entries(valeur)).get(nom)
    : undefined;

export const liste = (valeur: unknown): unknown[] => (Array.isArray(valeur) ? valeur : []);

export const seriesDe = (option: unknown): unknown[] => liste(champ(option, 'series'));
