import { Component, Inject, PLATFORM_ID, computed } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { SearchFilterComponent } from "../search-filter/search-filter-component";
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MapViewComponent } from "../charts/map-view/map-view.component";
import { isPlatformBrowser } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { cityEnum } from '../../models/enums/city.enum';
import { MarketInsightsComponent } from '../market-insights/market-insights.component';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { PriceTrendChartComponent } from '../charts/price-trend-chart/price-trend-chart.component';
import { PriceHistogramChartComponent } from '../charts/price-histogram-chart/price-histogram-chart.component';
import { DistrictPriceChartComponent } from '../charts/district-price-chart/district-price-chart.component';
import { SplitDonutChartComponent } from '../charts/split-donut-chart/split-donut-chart.component';

@Component({
    selector: 'app-dashboard',
    imports: [
        SearchFilterComponent,
        MatToolbarModule,
        MatIconModule,
        MapViewComponent,
        MatProgressSpinnerModule,
        MarketInsightsComponent,
        SummaryCardsComponent,
        PriceTrendChartComponent,
        PriceHistogramChartComponent,
        DistrictPriceChartComponent,
        SplitDonutChartComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

    isBrowser = false;

    public readonly charts = computed(() => this.calculateStatisticsService.charts());

    constructor(
        @Inject(PLATFORM_ID) private readonly platformId: Object,
        readonly calculateStatisticsService: CalculateStatisticsService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId)
    }

    public onGroupByTypeChange(type: string | null) {
        this.calculateStatisticsService.groupedBy.set(type || 'market');
    }

    public onCityChange(city: cityEnum) {
        if (city) {
            this.calculateStatisticsService.city.set(city);
        }
    }
}
