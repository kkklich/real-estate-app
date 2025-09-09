
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { Component, Input, Signal } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { Observable } from 'rxjs';
import { Property } from '../../../models/property';

@Component({
    selector: 'app-bar-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './bar-chart.component.html',
    styleUrl: './bar-chart.component.scss'
})
export class BarChartComponent {

    @Input() chartData!: Signal<ChartData<'bar'>>;
    @Input() chartTitle: string = '';

    public properties$!: Observable<Property[]>;
    filters = { city: '', market: '' };
    barChartType: 'bar' = 'bar';
    barChartLabels: string[] = [];

    barChartOptions: ChartOptions<'bar'> = {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.parsed.y?.toLocaleString()}`,
                }
            },
            title: {
                display: false,
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#22294a' }
            },
            y: {
                grid: { color: '#e9ecf6' },
                beginAtZero: true,
                ticks: {
                    color: '#6d748a',
                    callback: (value) => value.toLocaleString()
                }
            }
        }
    };

    constructor() { }

}
