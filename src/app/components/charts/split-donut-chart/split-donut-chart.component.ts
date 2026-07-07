import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SplitSlice } from '../../../models/dashboardCharts';

@Component({
    selector: 'app-split-donut-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './split-donut-chart.component.html',
    styleUrl: './split-donut-chart.component.scss'
})
export class SplitDonutChartComponent {

    readonly chartTitle = input<string>('');
    readonly slices = input<SplitSlice[]>([]);

    private readonly palette = [
        '#4d7cd6', '#7fb069', '#e6a23c', '#c95d63',
        '#8e7cc3', '#5bc0be', '#f28cb1', '#6d748a'
    ];

    protected readonly chartData = computed<ChartData<'doughnut'>>(() => {
        const slices = this.slices();
        return {
            labels: slices.map(s => s.name),
            datasets: [
                {
                    data: slices.map(s => s.count),
                    backgroundColor: slices.map((_, i) => this.palette[i % this.palette.length]),
                    borderWidth: 2,
                    borderColor: '#fff'
                }
            ]
        };
    });

    protected readonly chartOptions = computed<ChartOptions<'doughnut'>>(() => {
        const slices = this.slices();
        const total = slices.reduce((sum, s) => sum + s.count, 0);
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#6d748a', usePointStyle: true, boxWidth: 8 } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const slice = slices[ctx.dataIndex];
                            if (!slice) return '';
                            const percent = total > 0 ? Math.round(100 * slice.count / total) : 0;
                            return ` ${slice.count.toLocaleString()} offers (${percent}%) · median ${slice.medianPricePerMeter.toLocaleString()} PLN/m²`;
                        }
                    }
                }
            }
        };
    });
}
