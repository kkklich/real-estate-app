import { Component, computed, effect, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RealEstateDataService } from '../../services/real-estate-data.service';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { MarketInsights } from '../../models/marketInsights';
import { cityEnum } from '../../models/enums/city.enum';

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

    protected readonly insights = signal<MarketInsights | null>(null);
    protected readonly loading = signal<boolean>(false);

    protected readonly cheapestDistricts = computed(() =>
        (this.insights()?.districts ?? []).slice(0, 3)
    );

    protected readonly priciestDistricts = computed(() =>
        (this.insights()?.districts ?? []).slice(-3).reverse()
    );

    constructor(
        private readonly realEstateService: RealEstateDataService,
        protected readonly calculateStatisticsService: CalculateStatisticsService
    ) {
        effect(() => {
            const city = this.calculateStatisticsService.city();
            untracked(() => this.fetchInsights(city));
        });
    }

    private fetchInsights(city: cityEnum): void {
        this.loading.set(true);
        this.realEstateService.getMarketInsights(city).subscribe({
            next: data => {
                this.insights.set(data);
                this.loading.set(false);
            },
            error: err => {
                console.error('getMarketInsights error', err);
                this.insights.set(null);
                this.loading.set(false);
            }
        });
    }
}
