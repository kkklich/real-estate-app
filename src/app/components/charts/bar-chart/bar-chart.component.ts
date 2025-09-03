
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { Component, OnInit } from '@angular/core';
import { RealEstateService } from '../../../services/real-estate.service';
import { ChartDataset, ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-bar-chart',
  imports: [MatCardModule, BaseChartDirective],
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss'
})
export class BarChartComponent implements OnInit {

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` $${ctx.parsed.y?.toLocaleString()}`,
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
          callback: (value) => '$' + value.toLocaleString()
        }
      }
    }
  };
  //barChartType: ChartType = 'bar';
  barChartType: 'bar' = 'bar';
  barChartLabels: string[] = [];
  // barChartData: ChartDataset<'bar'>[] = [
  //   { data: [], label: 'Average Price', backgroundColor: '#3b82f6', borderRadius: 8 }
  // ];

  barChartData = {
    datasets: [
      { data: [10, 20, 30], label: 'Series A' }
    ],
    labels: ['Label 1', 'Label 2', 'Label 3']
  };
  loading = true;

  constructor(
    private realEstateService: RealEstateService,

  ) {
    // this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.realEstateService.getDashboardData().subscribe({
      next: (data) => {
        // Example expected structure:
        // data.averagePricePerDistrict = [{ district: 'Central', averagePrice: 320000 }, ... ]
        if (data && data.averagePricePerDistrict) {
          // this.barChartLabels = data.averagePricePerDistrict.map(d => d.district);
          // this.barChartData[0].data = data.averagePricePerDistrict.map(d => d.averagePrice);
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
