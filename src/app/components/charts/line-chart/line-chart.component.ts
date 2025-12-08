import { AfterViewInit, Component, Input, ViewChild, ElementRef, SimpleChanges, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';

@Component({
    selector: 'app-line-chart',
    imports: [],
    templateUrl: './line-chart.component.html',
    styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
    @ViewChild('chart', { static: false }) chartRef!: ElementRef<HTMLCanvasElement>;


    @Input() labels: string[] = [];
    @Input() dataPoints: number[] = [];
    @Input() chartTitle: string = 'Line Chart';

    chart!: Chart;

    ngOnChanges(changes: SimpleChanges) {
        if (changes) {
            this.updateChart();
        }
    }

    ngAfterViewInit(): void {
        this.updateChart();
    }

    ngOnDestroy(): void {
        this.chart?.destroy();
    }

    private updateChart(): void {
         if (!this.chartRef?.nativeElement) {
            return;
        }

        if (this.chart) {
            this.chart.destroy();
        }

        const config: ChartConfiguration = {
            type: 'line',
            data: {
                labels: this.labels,
                datasets: [{
                    label: this.chartTitle,
                    data: this.dataPoints,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { display: true, title: { display: true, text: 'Date' } },
                    y: { display: true, title: { display: true, text: 'Value' } }
                }
            }
        };

        this.chart = new Chart(this.chartRef.nativeElement, config);
    }
}