import { Injectable, signal, computed, OnDestroy, effect, untracked, Signal } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { PropertydataAPI } from "../models/property";
import { cityEnum } from "../models/enums/city.enum";
import { BarChartData } from "../models/barChartData";
import { realEstateStatisticsKey } from "../models/enums/statisticsParameter.enum";
import { map, Observable, tap } from "rxjs";

@Injectable({ providedIn: 'root' })

export class CalculateStatisticsService implements OnDestroy {

    public avgPriceString = signal<string>('');
    public priceString = signal<string>('');

    private readonly _data = signal<PropertydataAPI | null>(null);
    public readonly data = computed(() => this._data());
    public groupedBy = signal<string>('market');
    public city = signal<cityEnum>(cityEnum.Krakow);

    public isLoaded = false;

    public readonly hasData = computed(() => {
        const apiData = this._data();
        return !!apiData && (apiData.data?.length ?? 0) > 0;
    });

    private _barChartData = signal<BarChartData>({
        labels: [],
        datasets: [{ data: [], label: 'Liczba ofert' }]
    });
    public barChartDataByBuildingType = computed(() => this._barChartData());

    private _barChartFiltered = signal<BarChartData>({
        labels: [],
        datasets: [{ data: [], label: 'Liczba ofert' }]
    });
    public barChartFiltered = computed(() => this._barChartFiltered());

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
    private intervalId?: number;
    private fetching = false;

    constructor(private readonly realEstateService: RealEstateDataService) {
        this.setupSignalListener();
    }

    ngOnDestroy(): void {
        if (this.intervalId) clearInterval(this.intervalId);
    }

    private fetchData(city: cityEnum) {
        if (this.fetching) return;
        this.fetching = true;

        this.realEstateService.getDashboardData(city).subscribe({
            next: (data) => {
                this._data.set(data);
                this.fetching = false;
                this.isLoaded = true;
            },
            error: () => {
                this._data.set(null);
                this.fetching = false;
                this.isLoaded = false;
            }
        });
    }

    getData(): Signal<PropertydataAPI | null> {
        return this.data;
    }

    private setupSignalListener(): void {
        //  Effect 1: ONLY city changes → fetchData
        effect(() => {
            const city = this.city();  // Track ONLY city
            untracked(() => this.fetchData(city));
        });

        //  Effect 2: city + group changes → bar charts
        effect(() => {
            const city = this.city();    // Track city
            const group = this.groupedBy();  // Track group
            untracked(() => {
                this.fetchBarChartData();
                this.filterByParameter();
            });
        });
    }

    private fetchBarChartData(): void {
        const group = this.groupedBy();
        const city = this.city();

        this.realEstateService.getGroupedStatistics(group, city).subscribe({
            next: data => {
                this._barChartData.set(data)
            },
            error: err => {
                console.error('getGroupedStatistics error', err);
                this._barChartData.set({
                    labels: [],
                    datasets: [{ data: [], label: 'Liczba ofert' }]
                });
            }
        });
    }

    private filterByParameter(): void {
        const parameter = realEstateStatisticsKey.MedianPricePerMeter;
        const group = this.groupedBy();
        const city = this.city();

        this.realEstateService.filterByParameter(group, city, parameter).subscribe({
            next: data => this._barChartFiltered.set(data),
            error: () => {
                this._barChartFiltered.set({
                    labels: [],
                    datasets: [{ data: [], label: 'Liczba ofert' }]
                });
            }
        });
    };

    public getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }


    private convertNumberPrice(price: number): string {
        return price
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    private getPriceText(price: number): string {
        return `AVG total price : ${this.convertNumberPrice(price)} PLN`;
    };

    private getInfoText(pricePerMeter: number): string {
        return `AVG price per meter: ${this.convertNumberPrice(pricePerMeter)} PLN`;
    };


    public getTimelineData(): Observable<{ labels: string[]; dataPoints: number[]; countPoints: number[]; }> {
        const city = this.city();
        return this.realEstateService.getTimeLinePrice(city).pipe(
            tap(data => {
                this.avgPriceString.set(this.getInfoText(data[data.length - 1].avgPricePerMeter));
                this.priceString.set(this.getPriceText(data[data.length - 1].avgPrice));

            }),
            map(data => ({
                labels: data.map(item => item.addedDate.toString()),
                dataPoints: data.map(item => item.avgPricePerMeter),
                countPoints: data.map(item => item.count)
            }))
        );
    }
}