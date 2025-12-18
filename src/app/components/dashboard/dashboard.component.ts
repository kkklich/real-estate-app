import { Component, Inject, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { computed } from '@angular/core';
import { SearchFilterComponent } from "../search-filter/search-filter-component";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MapViewComponent } from "../charts/map-view/map-view.component";
import { BarChartComponent } from "../charts/bar-chart/bar-chart.component";
import { isPlatformBrowser } from '@angular/common';
import { realEstateStatisticsKey } from '../../models/enums/statisticsParameter.enum';
import { InfoLabels } from "../info-labels/info-labels.component";
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LineChartComponent } from "../charts/line-chart/line-chart.component";
import { RealEstateDataService } from '../../services/real-estate-data.service';
import { cityEnum } from '../../models/enums/city.enum';

@Component({
    selector: 'app-dashboard',
    imports: [
        SearchFilterComponent,
        MatToolbarModule,
        MatIconModule,
        MapViewComponent,
        BarChartComponent,
        InfoLabels,
        MatProgressSpinnerModule,
        LineChartComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

    @ViewChild(LineChartComponent) lineChart!: LineChartComponent;

    isBrowser = false;
    public realEstateStatisticsKey = realEstateStatisticsKey;
    protected labels: string[] = [];
    protected dataPoints: number[] = [];
    protected countPoints: number[] = [];

    public barChartDataByBuildingType = computed(() =>
        this.calculateStatisticsService.barChartDataByBuildingType()
    );


    public barChartDataMedianPricePerMeter = computed(() =>
        this.calculateStatisticsService.barChartFiltered()
    );

    constructor(
        @Inject(PLATFORM_ID) private readonly platformId: Object,
        readonly calculateStatisticsService: CalculateStatisticsService,
        private readonly realEstateService: RealEstateDataService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId)
    }

    ngOnInit(): void {
        this.getTimelineData();
    }

    public onGroupByTypeChange(type: string | null) {
        this.calculateStatisticsService.groupedBy.set(type || 'buildingType');
    }

    public onCityChange(city: cityEnum) {
        if (city) {
            this.calculateStatisticsService.city.set(city);
            this.getTimelineData();
        }
    }

    private getTimelineData(): void {
        this.calculateStatisticsService.getTimelineData().subscribe({
            next: ({ labels, dataPoints, countPoints }) => {
                setTimeout(() => {
                    this.labels = labels;
                    this.dataPoints = dataPoints;
                    this.countPoints = countPoints;

                    if (this.lineChart) {
                        this.lineChart.labels = this.labels;
                        this.lineChart.dataPoints = this.dataPoints;
                        this.lineChart.countPoints = this.countPoints;
                        this.lineChart.updateChart();
                    }
                }, 0);
            }
        });
    }
}
