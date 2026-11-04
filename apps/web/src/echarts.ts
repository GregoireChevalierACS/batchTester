// Seuls les graphiques et composants utilisés sont embarqués : ECharts complet pèse ~1 Mo.
import { BarChart, CustomChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

export const creerUnGraphique = (element: HTMLElement) =>
  echarts.init(element, null, { renderer: 'svg' });
