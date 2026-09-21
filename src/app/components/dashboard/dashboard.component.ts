import { Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { cityEnum } from '../../models/enums/city.enum';
import { SearchFilterComponent } from '../search-filter/search-filter-component';
import { MapViewComponent } from '../charts/map-view/map-view.component';
import { MarketInsightsComponent } from '../market-insights/market-insights.component';
import { PriceDropsComponent } from '../price-drops/price-drops.component';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { PriceTrendChartComponent } from '../charts/price-trend-chart/price-trend-chart.component';
import { PriceHistogramChartComponent } from '../charts/price-histogram-chart/price-histogram-chart.component';
import { DistrictPriceChartComponent } from '../charts/district-price-chart/district-price-chart.component';
import { SplitDonutChartComponent } from '../charts/split-donut-chart/split-donut-chart.component';
import { provideAppCharts } from '../charts/chart-setup';

@Component({
    selector: 'app-dashboard',
    imports: [
        SearchFilterComponent,
        MatToolbarModule,
        MatIconModule,
        MatButtonModule,
        MapViewComponent,
        MatProgressSpinnerModule,
        MarketInsightsComponent,
        PriceDropsComponent,
        SummaryCardsComponent,
        PriceTrendChartComponent,
        PriceHistogramChartComponent,
        DistrictPriceChartComponent,
        SplitDonutChartComponent
    ],
    // Registers Chart.js for the five charts below; see chart-setup.ts.
    providers: [provideAppCharts()],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

    readonly stats = inject(CalculateStatisticsService);

    // Charts and the map need a canvas / WebGL context, so the grid is client-only.
    readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly charts = this.stats.charts;

    onCityChange(city: cityEnum): void {
        if (city) {
            this.stats.city.set(city);
        }
    }
}
