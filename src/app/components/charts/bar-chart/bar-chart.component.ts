
import { MatCardModule } from '@angular/material/card';
import { AsyncPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import { map, Observable } from 'rxjs';
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
  loading = true;

  constructor(readonly calculateStatisticsService: CalculateStatisticsService) { }

  ngOnInit(): void {
    this.loadchartData(this.calculateStatisticsService.groupedBy);
  }

  private loadchartData(groupType?: string): void {
    this.chartData$ = this.calculateStatisticsService.getBarChartDataByBuildingType$(groupType).pipe(
      map(data => data ?? { datasets: [], labels: [] } as ChartData<'bar'>)
    );
  }

  onFiltersChange(filter: string) {
    this.calculateStatisticsService.groupedBy = filter;
    this.loadchartData(this.calculateStatisticsService.groupedBy);
  }
}
