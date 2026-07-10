import { Injectable, signal, computed, effect, untracked } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { cityEnum } from "../models/enums/city.enum";
import { DashboardCharts } from "../models/dashboardCharts";
import { MapPoint } from "../models/mapPoint";
import { MarketInsights } from "../models/marketInsights";

@Injectable({ providedIn: 'root' })

export class CalculateStatisticsService {

    private readonly _charts = signal<DashboardCharts | null>(null);
    public readonly charts = computed(() => this._charts());

    private readonly _insights = signal<MarketInsights | null>(null);
    public readonly insights = computed(() => this._insights());

    private readonly _mapPoints = signal<MapPoint[] | null>(null);
    public readonly mapPoints = computed(() => this._mapPoints());

    public groupedBy = signal<string>('market');
    public city = signal<cityEnum>(cityEnum.Krakow);

    public readonly hasData = computed(() => this._charts() !== null);

    public groupByTypes: string[] = [
        'price',
        'pricePerMeter',
        'floor',
        'market',
        'buildingType',
        'area',
        'private',
        'location.district'
    ];

    constructor(private readonly realEstateService: RealEstateDataService) {
        this.setupSignalListener();
    }

    private setupSignalListener(): void {
        effect(() => {
            const city = this.city();
            untracked(() => this.fetchFullDashboard(city));
        });
    }

    private fetchFullDashboard(city: cityEnum): void {
        this.realEstateService.getFullDashboard(city).subscribe({
            next: data => {
                this._charts.set(data.charts);
                this._insights.set(data.insights);
                this._mapPoints.set(data.mapPoints);
            },
            error: err => {
                console.error('getFullDashboard error', err);
                this._charts.set(null);
                this._insights.set(null);
                this._mapPoints.set(null);
            }
        });
    }

    public getData(): MapPoint[] | null {
        return this._mapPoints();
    }

    public getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }
}
