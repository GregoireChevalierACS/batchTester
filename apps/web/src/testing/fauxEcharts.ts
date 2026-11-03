import type { EChartsOption } from 'echarts';

export interface FauxGraphique {
  readonly element: HTMLElement;
  readonly options: EChartsOption[];
  redimensionnements: number;
  detruit: boolean;
}

const graphiques: FauxGraphique[] = [];

/** Doublure d'ECharts : chaque graphique créé garde ses options et son cycle de vie. */
export const fauxEcharts = {
  graphiques,
  creer: (element: HTMLElement) => {
    const graphique: FauxGraphique = {
      element,
      options: [],
      redimensionnements: 0,
      detruit: false,
    };
    graphiques.push(graphique);
    return {
      setOption: (option: EChartsOption) => {
        graphique.options.push(option);
      },
      resize: () => {
        graphique.redimensionnements += 1;
      },
      dispose: () => {
        graphique.detruit = true;
      },
    };
  },
  oublier: () => {
    graphiques.length = 0;
  },
};
