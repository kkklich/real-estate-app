import { Component, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalculateStatisticsService } from '../../services/calculate-statistics';

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

    protected readonly insights = computed(() => this.calculateStatisticsService.insights());
    protected readonly loading = computed(() => this.insights() === null);

    protected readonly cheapestDistricts = computed(() =>
        (this.insights()?.districts ?? []).slice(0, 3)
    );

    protected readonly priciestDistricts = computed(() =>
        (this.insights()?.districts ?? []).slice(-3).reverse()
    );

    constructor(
        protected readonly calculateStatisticsService: CalculateStatisticsService
    ) { }
}
