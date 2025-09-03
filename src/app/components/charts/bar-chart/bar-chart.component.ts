
import { MatCardModule } from '@angular/material/card';
import { AsyncPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import { map, Observable, of } from 'rxjs';
import { Property } from '../../../models/property';

@Component({
  selector: 'app-bar-chart',
  imports: [MatCardModule, BaseChartDirective, AsyncPipe],
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss'
})
export class BarChartComponent implements OnInit {

  public properties$!: Observable<Property[]>;
  filters = { city: '', market: '' };

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

  barChartType: 'bar' = 'bar';
  barChartLabels: string[] = [];
  chartData$!: Observable<ChartData<'bar'>>;
  groupedBy: string = 'market';
  loading = true;

  constructor(private readonly calculateStatisticsService: CalculateStatisticsService) { }

  ngOnInit(): void {
    this.loadchartData(this.groupedBy);
  }

  private loadchartData(groupType?: string): void {
    // this.chartData$ = of({ datasets: [], labels: [] } as ChartData<'bar'>);
    this.chartData$ = this.calculateStatisticsService.getBarChartDataByBuildingType$(groupType).pipe(
      map(data => data ?? { datasets: [], labels: [] } as ChartData<'bar'>)
    );

    console.log('Chart data loaded:', this.chartData$);
  }

  onFiltersChange(filter: string) {
    this.groupedBy = filter;
    console.log('Grouped by changed t3333o:', this.groupedBy);
    this.loadchartData(this.groupedBy);

    // this.chartData$ = of({ datasets: [], labels: [] } as ChartData<'bar'>);
  }
}
