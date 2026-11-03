import type { Systeme } from '@batchtester/core';

// Forme correcte, définition invalide : c'est le runner qui en rapporte les défauts.
export default {
  definition: { nom: 'Sans version', version: '', parametres: [], mesures: [] },
  simuler: () => ({}),
} satisfies Systeme;
