import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { computed } from '@angular/core';
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
  public barChartDataByBuildingType = computed(() =>
    this.calculateStatisticsService.barChartDataByBuildingType()
  );

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    readonly calculateStatisticsService: CalculateStatisticsService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  public onGroupByTypeChange(type: string | null) {
    this.calculateStatisticsService.groupedBy.set(type || 'buildingType');
  }

}
