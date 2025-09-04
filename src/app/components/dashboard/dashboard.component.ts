import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { ChartData } from 'chart.js';
import { Observable, map } from 'rxjs';
import { SearchFilterComponent } from "../search-filter/search-filter-component";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MapViewComponent } from "../charts/map-view/map-view.component";
import { BarChartComponent } from "../charts/bar-chart/bar-chart.component";
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [
    SearchFilterComponent,
    MatToolbarModule,
    MapViewComponent,
    BarChartComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  isBrowser = false;
  data$!: Observable<ChartData<'bar'>>;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    readonly calculateStatisticsService: CalculateStatisticsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.loadChartData();
  }
  public onGroupByTypeChange(type: string | null) {
    this.calculateStatisticsService.groupedBy = type || 'buildingType';
    this.loadChartData();
  }

  private loadChartData() {
    this.data$ = this.calculateStatisticsService.getBarChartDataByBuildingType$().pipe(
      map(data => data ?? { datasets: [], labels: [] } as ChartData<'bar'>)
    );
  }
}
