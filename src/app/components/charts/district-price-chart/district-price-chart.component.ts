import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { DistrictPrice } from '../../../models/marketInsights';

@Component({
    selector: 'app-district-price-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './district-price-chart.component.html',
    styleUrl: './district-price-chart.component.scss'
})
export class DistrictPriceChartComponent {

    readonly districts = input<DistrictPrice[]>([]);

    protected readonly chartData = computed<ChartData<'bar'>>(() => ({
        labels: this.districts().map(d => d.district),
        datasets: [
            {
                data: this.districts().map(d => d.medianPricePerMeter),
                label: 'Median PLN / m²',
                backgroundColor: '#7fa6e8',
                hoverBackgroundColor: '#234392',
                borderRadius: 3
            }
        ]
    }));

    protected readonly chartOptions = computed<ChartOptions<'bar'>>(() => {
        const districts = this.districts();
        return {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const district = districts[ctx.dataIndex];
                            return ` ${ctx.parsed.x?.toLocaleString()} PLN / m² (${district?.count ?? 0} offers)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#e9ecf6' },
                    ticks: { color: '#6d748a', callback: (value) => Number(value).toLocaleString() }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#22294a' }
                }
            }
        };
    });
}
