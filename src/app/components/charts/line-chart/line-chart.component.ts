import { AfterViewInit, Component, Input, ViewChild, ElementRef, OnDestroy } from '@angular/core';
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
    @Input() countPoints: number[] = [];
    @Input() chartTitle: string = 'Line Chart';

    chart!: Chart;
    ngAfterViewInit(): void {
        this.updateChart();
    }

    ngOnDestroy(): void {
        this.chart?.destroy();
    }

    public updateChart(): void {
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
                datasets: [
                    {
                        label: `Real Estate Count (Left)`,
                        data: this.countPoints,
                        yAxisID: 'y',
                        fill: false,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    },
                    {
                        label: `${this.chartTitle} (Right)`,
                        data: this.dataPoints,
                        yAxisID: 'y1',
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        display: true,
                        title: { display: true, text: 'Date' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Price' },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Quantity' }
                    }
                }
            }
        };

        this.chart = new Chart(this.chartRef.nativeElement, config);
    }
}