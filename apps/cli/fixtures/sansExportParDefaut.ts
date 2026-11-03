import type { Systeme } from '@batchtester/core';

// Système valide, mais exporté sous un nom : la ligne de commande attend l'export par défaut.
export const systeme: Systeme = {
  definition: { nom: 'Nommé', version: '1.0.0', parametres: [], mesures: [] },
  simuler: () => ({}),
};
