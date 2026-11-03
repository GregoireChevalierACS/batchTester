export type { DemandeDeLotADistance, EvenementDeLot } from './evenements.ts';
export {
  ITERATIONS_MAXIMALES,
  lancerUnLot,
  SIMULTANEES_PAR_DEFAUT,
  type DemandeDeLot,
  type EchecDIteration,
  type Iteration,
  type Lot,
  type OptionsDeLot,
  type ProblemeDeLot,
} from './lancerUnLot.ts';
export { expliquerUnProblemeDeLot } from './messages.ts';
export type { Simulateur } from './ports.ts';
export {
  POINTS_DE_CONVERGENCE,
  resumerLeLot,
  type ConvergenceDeCategorie,
  type ResumeDeLot,
  type ResumeDeMesure,
} from './resumerLeLot.ts';
