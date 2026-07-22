import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { TimelinePoint } from '../../../models/dashboardCharts';

@Component({
    selector: 'app-price-trend-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './price-trend-chart.component.html',
    styleUrl: './price-trend-chart.component.scss'
})
export class PriceTrendChartComponent {

    readonly timeline = input<TimelinePoint[]>([]);

    // "dd-MM-yyyy" as sent by the API. Parsed to a timestamp rather than kept as a label so the
    // x axis can space the points by the time between them - scrapes are not evenly spaced
    // (gaps run from 3 days to 2 months), and a category axis draws every gap the same width,
    // flattening a two-month move into what looks like a single week.
    private static toTimestamp(date: string): number {
        const [day, month, year] = date.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    }

    protected readonly chartData = computed<ChartData>(() => {
        const points = this.timeline();
        return {
            datasets: [
                {
                    type: 'line' as const,
                    label: 'Avg price / m² (PLN)',
                    data: points.map(p => ({ x: PriceTrendChartComponent.toTimestamp(p.date), y: p.avgPricePerMeter })),
                    yAxisID: 'y',
                    borderColor: '#234392',
                    backgroundColor: 'rgba(35, 67, 146, 0.08)',
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true
                },
                {
                    type: 'bar' as const,
                    label: 'Offers collected',
                    data: points.map(p => ({ x: PriceTrendChartComponent.toTimestamp(p.date), y: p.count })),
                    yAxisID: 'y1',
                    backgroundColor: 'rgba(109, 116, 138, 0.3)',
                    borderRadius: 3,
                    // On a linear axis every bar is sized from the shortest gap in the series (3 days
                    // out of a 359-day span), so the default 0.8 x 0.9 shrink leaves a ~5px sliver.
                    // Filling the slot instead still cannot overlap - the slot is the tightest pair.
                    categoryPercentage: 1,
                    barPercentage: 1
                }
            ]
        };
    });

    protected readonly chartOptions: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { color: '#6d748a', usePointStyle: true } },
            tooltip: {
                callbacks: {
                    // the axis is a timestamp now, so the exact scrape date lives in the tooltip
                    title: (items) => new Date(items[0].parsed.x).toLocaleDateString('pl-PL'),
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()}`
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                grid: { display: false },
                ticks: {
                    color: '#6d748a',
                    maxTicksLimit: 8,
                    callback: (value) => new Date(Number(value)).toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' })
                }
            },
            y: {
                position: 'left',
                // The chart type is 'bar', and Chart.js applies the bar controller's value-axis
                // defaults - beginAtZero among them - to every y scale, this one included. The
                // price band is only ~6% wide, so a zeroed axis drew the year as a flat line
                // 13px tall. Opt out and pad the real range instead.
                beginAtZero: false,
                grace: '15%',
                grid: { color: '#e9ecf6' },
                ticks: { color: '#234392', callback: (value) => Number(value).toLocaleString() },
                title: { display: true, text: 'PLN / m²', color: '#6d748a' }
            },
            y1: {
                position: 'right',
                beginAtZero: true,
                grid: { display: false },
                ticks: { color: '#6d748a' },
                title: { display: true, text: 'offers', color: '#6d748a' }
            }
        }
    };
}
