import { Component, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
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

  @ViewChild(BarChartComponent) barChartComponent!: BarChartComponent;
  isBrowser = false;

  public onGroupByTypeChange(type: string | null) {
    // Handle the change event here
    console.log('Group by type changedsss:', type);
    // You can add your action logic here
    if (this.barChartComponent && type) {
      this.barChartComponent.onFiltersChange(type);
    }
  }

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

}
