import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { DistrictPrice } from '../../models/marketInsights';

@Component({
    selector: 'app-market-insights',
    imports: [
        DecimalPipe,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './market-insights.component.html',
    styleUrl: './market-insights.component.scss'
})
export class MarketInsightsComponent {

    /** How many districts each of the cheapest / priciest lists shows at most. */
    private static readonly LIST_SIZE = 3;

    protected readonly stats = inject(CalculateStatisticsService);

    protected readonly insights = this.stats.insights;
    protected readonly loading = this.stats.dashboard.loading;
    protected readonly error = this.stats.dashboard.error;

    // Sorted here rather than trusting the API's order: the two lists below are
    // labelled "cheapest" and "most expensive", so they must not depend on an
    // ordering the server is free to change.
    private readonly sortedDistricts = computed(() =>
        [...(this.insights()?.districts ?? [])]
            .sort((a, b) => a.medianPricePerMeter - b.medianPricePerMeter)
    );

    // Capped at half the districts so the same district can never appear in both
    // lists - with 4 districts, a flat slice(0,3)/slice(-3) overlaps on two of them.
    private readonly listSize = computed(() =>
        Math.min(MarketInsightsComponent.LIST_SIZE, Math.floor(this.sortedDistricts().length / 2))
    );

    protected readonly cheapestDistricts = computed<DistrictPrice[]>(() =>
        this.sortedDistricts().slice(0, this.listSize())
    );

    protected readonly priciestDistricts = computed<DistrictPrice[]>(() => {
        const size = this.listSize();
        return size === 0 ? [] : this.sortedDistricts().slice(-size).reverse();
    });
}
