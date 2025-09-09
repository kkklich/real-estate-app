import { Component, effect } from '@angular/core';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { ChartConfiguration } from 'chart.js';

@Component({
    selector: 'app-grouped-chart',
    imports: [MatCardModule, BaseChartDirective],
    templateUrl: './grouped-chart.component.html',
    styleUrls: ['./grouped-chart.component.scss']
})
export class GroupedChartComponent {


    constructor(private readonly calculateStatisticsService: CalculateStatisticsService) {
        effect(() => {
            // Listen only to changes in groupedBy signal
            void this.calculateStatisticsService.groupedBy();
            this.loadChartData();
        });

        //public groupedBy = signal<string>('market'); please listen to changes from the calculateStatisticsService
        // this.calculateStatisticsService.groupedBy().subscribe(() => {
        //     this.loadChartData();
        // });
    }

    private async loadChartData() {
        const data = await this.calculateStatisticsService.getDataWithGroupStatistics();
        // const chartData = this.generateGroupedChartData(data);
        this.barChartData = this.buildChartData(data);
        // console.log('wykres grupowany', this.barChartData);
        return this.barChartData;
    }
    public barChartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Porównanie Pierwotny vs Wtórny',
            },
        },
    };

    barChartType: 'bar' = 'bar';
    public barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };

    buildChartData(input: Record<any, GroupData>): ChartConfiguration<'bar'>['data'] {
        // const labels = ['averageFloor', 'count', 'medianArea', 'medianPrice', 'medianPricePerMeter'];
        const labels = Array.from(
            new Set(Object.values(input).flatMap(group => Object.keys(group)))
        );

        const datasets = Object.entries(input).map(([group, values], idx) => ({
            label: group,
            data: labels.map(label => values[label as keyof GroupData]),
            backgroundColor: this.getColor(idx)
        }));

        return {
            labels,
            datasets
        };
    }

    getColor(idx: number): string {
        const palette = [
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];
        return palette[idx % palette.length];
    }
}
