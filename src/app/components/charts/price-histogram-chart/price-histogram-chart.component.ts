import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { HistogramBin } from '../../../models/dashboardCharts';

@Component({
    selector: 'app-price-histogram-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './price-histogram-chart.component.html',
    styleUrl: './price-histogram-chart.component.scss'
})
export class PriceHistogramChartComponent {

    readonly bins = input<HistogramBin[]>([]);

    protected readonly chartData = computed<ChartData<'bar'>>(() => ({
        labels: this.bins().map(b => b.label),
        datasets: [
            {
                data: this.bins().map(b => b.count),
                label: 'Offers',
                backgroundColor: '#4d7cd6',
                hoverBackgroundColor: '#234392',
                borderRadius: 3
            }
        ]
    }));

    protected readonly chartOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => `${items[0].label} PLN / m²`,
                    label: (ctx) => ` ${ctx.parsed.y?.toLocaleString()} offers`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#6d748a', maxRotation: 60, minRotation: 45 },
                title: { display: true, text: 'PLN / m²', color: '#6d748a' }
            },
            y: {
                beginAtZero: true,
                grid: { color: '#e9ecf6' },
                ticks: { color: '#6d748a' },
                title: { display: true, text: 'offers', color: '#6d748a' }
            }
        }
    };
}
