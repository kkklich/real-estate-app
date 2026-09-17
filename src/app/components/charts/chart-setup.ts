import {
    ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler,
    Legend, LineController, LineElement, LinearScale, PointElement, Tooltip
} from 'chart.js';
import { provideCharts } from 'ng2-charts';

/**
 * Registers only the Chart.js pieces this app draws with: line + bar + doughnut charts on
 * linear and category scales, with tooltips, legends and area fill.
 *
 * It replaces a root-level provideCharts(withDefaultRegisterables()), which registered every
 * controller, scale and plugin and put all of Chart.js in the initial bundle - even for
 * /properties, which draws no charts. Provide it on the component that hosts the charts
 * (dashboard, offer history) so Chart.js ships in that route's lazy chunk instead.
 *
 * Adding a new chart type, scale or plugin? Register it here, or Chart.js throws
 * '"<type>" is not a registered controller' at runtime.
 */
export function provideAppCharts() {
    return provideCharts({
        registerables: [
            LineController, BarController, DoughnutController,
            LineElement, PointElement, BarElement, ArcElement,
            LinearScale, CategoryScale,
            Tooltip, Legend, Filler
        ]
    });
}
