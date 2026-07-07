import { Injectable, signal, computed, effect, untracked, Signal } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { cityEnum } from "../models/enums/city.enum";
import { DashboardCharts } from "../models/dashboardCharts";
import { MapPoint } from "../models/mapPoint";

@Injectable({ providedIn: 'root' })

export class CalculateStatisticsService {

    // slim map points - only the map consumes them, loaded in the background
    private readonly _data = signal<MapPoint[] | null>(null);
    public readonly data = computed(() => this._data());

    // compact pre-aggregated charts payload - the dashboard renders from this
    private readonly _charts = signal<DashboardCharts | null>(null);
    public readonly charts = computed(() => this._charts());

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
            untracked(() => {
                this.fetchCharts(city);
                this.fetchData(city);
            });
        });
    }

    private fetchCharts(city: cityEnum): void {
        this.realEstateService.getDashboardCharts(city).subscribe({
            next: charts => this._charts.set(charts),
            error: err => {
                console.error('getDashboardCharts error', err);
                this._charts.set(null);
            }
        });
    }

    private fetchData(city: cityEnum) {
        this.realEstateService.getMapPoints(city).subscribe({
            next: (data) => this._data.set(data),
            error: () => this._data.set(null)
        });
    }

    getData(): Signal<MapPoint[] | null> {
        return this.data;
    }

    public getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }
}
