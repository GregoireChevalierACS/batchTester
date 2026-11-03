import type { Systeme } from '@batchtester/core';

export default {
  definition: {
    nom: 'Bon',
    version: '1.0.0',
    parametres: [],
    mesures: [{ kind: 'nombre', nom: 'valeur' }],
  },
  simuler: (_valeurs, aleatoire) => ({ valeur: aleatoire.entier(1, 6) }),
} satisfies Systeme;
