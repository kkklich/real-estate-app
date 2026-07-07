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

    protected readonly chartData = computed<ChartData>(() => {
        const points = this.timeline();
        return {
            labels: points.map(p => p.date),
            datasets: [
                {
                    type: 'line' as const,
                    label: 'Avg price / m² (PLN)',
                    data: points.map(p => p.avgPricePerMeter),
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
                    data: points.map(p => p.count),
                    yAxisID: 'y1',
                    backgroundColor: 'rgba(109, 116, 138, 0.3)',
                    borderRadius: 3
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
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#6d748a', maxTicksLimit: 12 }
            },
            y: {
                position: 'left',
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
