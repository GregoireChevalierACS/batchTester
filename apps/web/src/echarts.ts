// Seuls les graphiques et composants utilisés sont embarqués : ECharts complet pèse ~1 Mo.
import { BarChart, CustomChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  CustomChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

export const creerUnGraphique = (element: HTMLElement) =>
  echarts.init(element, null, { renderer: 'svg' });
