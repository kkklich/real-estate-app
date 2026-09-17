import { TestBed } from '@angular/core/testing';
import { Type, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { BaseChartDirective } from 'ng2-charts';
import { Chart } from 'chart.js';
import { provideAppCharts } from './chart-setup';
import { PriceTrendChartComponent } from './price-trend-chart/price-trend-chart.component';
import { PriceHistogramChartComponent } from './price-histogram-chart/price-histogram-chart.component';
import { DistrictPriceChartComponent } from './district-price-chart/district-price-chart.component';
import { SplitDonutChartComponent } from './split-donut-chart/split-donut-chart.component';

/**
 * Chart.js is registered piece by piece (chart-setup.ts), not with withDefaultRegisterables().
 * A missing controller or scale throws only once a chart renders; a missing plugin does not
 * throw at all - the legend, tooltip or area fill just silently disappears. So each chart is
 * rendered here with nothing but provideAppCharts() and checked for all of it.
 */
describe('provideAppCharts', () => {

    function renderChart<T>(component: Type<T>, inputs: Record<string, unknown>): Chart {
        TestBed.configureTestingModule({
            imports: [component],
            providers: [provideZonelessChangeDetection(), provideAppCharts()]
        });
        const fixture = TestBed.createComponent(component);
        for (const [name, value] of Object.entries(inputs)) {
            fixture.componentRef.setInput(name, value);
        }
        fixture.detectChanges();

        const directive = fixture.debugElement.query(By.directive(BaseChartDirective))?.injector.get(BaseChartDirective);
        expect(directive).withContext('chart canvas rendered').toBeDefined();
        const chart = directive!.chart;
        expect(chart).withContext('Chart.js instance created').toBeDefined();
        return chart!;
    }

    function expectLegendAndTooltip(chart: Chart): void {
        expect(chart.legend).withContext('Legend plugin registered').toBeDefined();
        expect(chart.tooltip).withContext('Tooltip plugin registered').toBeDefined();
    }

    it('registers the area-fill plugin the trend and history charts use', () => {
        renderChart(SplitDonutChartComponent, { slices: [{ name: 'x', count: 1, medianPricePerMeter: 1 }] });

        expect(Chart.registry.plugins.get('filler')).withContext('Filler plugin').toBeDefined();
    });

    it('renders the price trend (mixed line + bar on linear scales)', () => {
        const chart = renderChart(PriceTrendChartComponent, {
            timeline: [
                { date: '01-06-2026', avgPricePerMeter: 15_000, avgPrice: 600_000, count: 120 },
                { date: '10-07-2026', avgPricePerMeter: 15_400, avgPrice: 610_000, count: 90 }
            ]
        });

        expect(chart.data.datasets.map(d => d.type)).toEqual(['line', 'bar']);
        expect(chart.scales['x'].type).toBe('linear');
        expectLegendAndTooltip(chart);
    });

    it('renders the histogram (bar on a category scale)', () => {
        const chart = renderChart(PriceHistogramChartComponent, {
            bins: [{ label: '10-12k', count: 5 }, { label: '12-14k', count: 9 }]
        });

        expect(chart.scales['x'].type).toBe('category');
        expect(chart.tooltip).toBeDefined();
    });

    it('renders the district chart (horizontal bar)', () => {
        const chart = renderChart(DistrictPriceChartComponent, {
            districts: [{ district: 'Podgorze', medianPricePerMeter: 15_000, count: 12 }]
        });

        expect(chart.scales['y'].type).toBe('category');
        expect(chart.scales['x'].type).toBe('linear');
    });

    it('renders the split donut (doughnut)', () => {
        const chart = renderChart(SplitDonutChartComponent, {
            chartTitle: 'Market',
            slices: [
                { name: 'Pierwotny', count: 10, medianPricePerMeter: 15_000 },
                { name: 'Wtorny', count: 30, medianPricePerMeter: 13_000 }
            ]
        });

        expect(chart.getDatasetMeta(0).type).withContext('doughnut controller in use').toBe('doughnut');
        expectLegendAndTooltip(chart);
    });
});
