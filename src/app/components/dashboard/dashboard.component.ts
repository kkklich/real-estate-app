import { Component, effect, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { computed } from '@angular/core';
import { SearchFilterComponent } from "../search-filter/search-filter-component";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MapViewComponent } from "../charts/map-view/map-view.component";
import { BarChartComponent } from "../charts/bar-chart/bar-chart.component";
import { isPlatformBrowser } from '@angular/common';
import { realEstateStatisticsKey } from '../../models/enums/statisticsParameter.enum';

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
    public realEstateStatisticsKey = realEstateStatisticsKey;
    public barChartDataByBuildingType = computed(() =>
        this.calculateStatisticsService.barChartDataByBuildingType()
    );

    public barChartData = (parameter: string) =>
        computed(() => this.calculateStatisticsService.filterByParameter(parameter)());//todo fix it

    constructor(
        @Inject(PLATFORM_ID) private readonly platformId: Object,
        readonly calculateStatisticsService: CalculateStatisticsService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId)
    }

    public onGroupByTypeChange(type: string | null) {
        this.calculateStatisticsService.groupedBy.set(type || 'buildingType');
    }
}
