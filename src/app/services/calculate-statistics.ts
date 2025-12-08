import { Injectable, signal, computed, OnDestroy, Inject, PLATFORM_ID, effect, NgZone, untracked } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { Property, PropertydataAPI } from "../models/property";
import { RealEstateStatistics } from "../models/resultStatistics";
import { ChartConfiguration } from "chart.js";
import { copyFile } from "fs";
import { cityEnum } from "../models/enums/city.enum";

@Injectable({ providedIn: 'root' })

export class CalculateStatisticsService implements OnDestroy {
    public data = signal<PropertydataAPI>({ totalCount: 0, data: [] });
    public groupedBy = signal<string>('market');
    public city = signal<cityEnum>(cityEnum.Krakow);
    public hasData = computed(() => (this.data().data?.length ?? 0) > 0);

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
    private lastFetched?: number;       // timestamp of last successful fetch (ms)
    private fetching = false;

    constructor(private readonly realEstateService: RealEstateDataService,
               private readonly ngZone: NgZone
  ) {
        // this.getData();

        this.setupSignalListener();
    }

    ngOnDestroy(): void {
        if (this.intervalId) clearInterval(this.intervalId);
    }

    private fetchData(city: cityEnum) {
        if (this.fetching) return;
        this.fetching = true;

        console.log('Fetching data for city:', city);
        this.realEstateService.getDashboardData(city).subscribe({
            next: (data) => {
                this.data.set(data);   //this line wrror
                this.lastFetched = Date.now(); // store fetch time
                this.fetching = false;
            },
            error: () => {
                this.fetching = false;
            }
        });
    }

    getData() {
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const isFresh = this.lastFetched !== undefined && (now - this.lastFetched) < ONE_DAY;

        // If we have no data or data is stale (>1 day) -> fetch
        if (!isFresh || !this.hasData()) {
            this.fetchData(this.city());
        }

        return this.data;
    }

    // public getCityData = computed(() => {
    //     const city = this.city();
    //     console.log('dddd', city);
    //     this.fetchData(city);
    //     return this.data().data.filter(item => item.location.city === city);
    // });

     private setupSignalListener(): void {
        effect(() => {
            console.log('City changed to:', this.city());
            const value = this.city();
            
            // Run outside Angular zone to avoid change detection issues
            // this.ngZone.runOutsideAngular(() => {
            //     this.fetchData(value);
            // });


            untracked(() => {
             this.fetchData(value);
            });
        });
    }


//    private setupSignalListener(): void {
//         effect(() => {
//             console.log('City changed to:', this.city());
//             const value = this.city(); // Replace 'yourSignal' with your signal name
//             // this.fetchData(value); // Replace with your service function

//             setTimeout(() => {
//                 this.fetchData(value); // Now safe from ExpressionChangedAfterItHasBeenCheckedError
//             }, 0);
//         });
//     }
    public barChartDataByBuildingType = computed(() => {
        const results = this.data();
        const groupedBy = this.groupedBy();
        console.log('Grouped by:', groupedBy);
        if (!results || results.data.length === 0) {
            return {
                datasets: [
                    { data: [], label: 'Liczba ofert' }
                ],
                labels: []
            };
        }
        const groupMap = new Map<string, number>();
        results.data.forEach(item => {
            let key = this.getNested(item, groupedBy);
            if (typeof key === 'number') {
                key = Math.round(key).toString();
            } else if (typeof key === 'boolean') {
                key = key.toString();
            } else {
                key = key ?? 'Unknown';
            }
            groupMap.set(key, (groupMap.get(key) || 0) + 1);
        });
        const keys = Array.from(groupMap.keys());
        const allNumeric = keys.every(key => !isNaN(Number(key)));
        let labels: string[];
        let counts: number[];
        if (allNumeric) {
            let binSize = this.getBinSizeValue(groupedBy);
            const bins = this.binNumericKeys(keys, groupMap, binSize);
            const pairs = Array.from(bins.entries())
                .map(([key, value]) => ({ key, value }))
                .sort((a, b) => Number(a.key) - Number(b.key));

            labels = pairs.map(pair => pair.key.toString());
            counts = pairs.map(pair => pair.value);
        } else {
            labels = keys;
            counts = keys.map(key => groupMap.get(key)!);
        }

        return {
            datasets: [
                { data: counts, label: 'Liczba ofert' }
            ],
            labels
        };
    });

    private getBinSizeValue(key: string): number {
        switch (key) {
            case 'pricePerMeter': return 200;
            case 'price': return 5000;
            default: return 1;
        }
    }

    binNumericKeys(
        keys: string[],
        groupMap: Map<string, number>,
        binSize: number = 50
    ): Map<string, number> {
        const bins: Map<string, number> = new Map();
        keys.forEach(key => {
            const num = Number(key);
            if (isNaN(num)) return;
            const binEnd = Math.ceil(num / binSize) * binSize;
            const binLabel = binEnd.toString();
            bins.set(binLabel, (bins.get(binLabel) || 0) + (groupMap.get(key) || 0));
        });
        return bins;
    }

    public getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }

    public getDataWithGroupStatistics(): Record<any, RealEstateStatistics> {
        const groupByProperty = this.groupedBy();
        const propertyParts = groupByProperty.split('.');
        const response = this.data();

        const keySelector = (x: Property): any => {
            let value: any = x;
            for (const part of propertyParts) {
                if (value == null) return null;
                value = value[part];
            }
            return value;
        };

        const groupedByData = this.calculateStatisticsGroupBy(response.data, keySelector);
        return groupedByData;
    }

    public calculateStatisticsGroupBy<TKey extends string | number | symbol>(
        data: Property[],
        keySelector: (x: Property) => TKey
    ): Record<TKey, RealEstateStatistics> {
        const groups = new Map<TKey, Property[]>();
        for (const item of data) {
            const key = keySelector(item);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }

        const result: Record<TKey, RealEstateStatistics> = {} as Record<TKey, RealEstateStatistics>;
        Array.from(groups.entries())
            .map(([key, group]) => ({
                Key: key,
                Stats: this.displayStatistics(group)
            }))
            .sort((a, b) => a.Stats.medianPricePerMeter - b.Stats.medianPricePerMeter)
            .forEach(x => {
                result[x.Key] = x.Stats;
            });

        return result;
    }

    private displayStatistics(data: Property[]): RealEstateStatistics {
        return {
            medianPricePerMeter: this.calculateMedianPricePerMeter(data),
            medianPrice: this.calculateAveragePrice(data),
            medianArea: this.calculateMedianArea(data),
            averageFloor: this.calculateAverageFloor(data),
            count: data.length
        };
    }

    private calculateAveragePrice(data: Property[]): number {
        if (data.length === 0) return 0;
        return data.reduce((acc, x) => acc + x.price, 0) / data.length;
    }
    public getPriceText(): string {
        const data = this.data();
        const price = this.calculateAveragePrice(data.data);
        return `Średnia cena : ${this.convertNumberPrice(price)} PLN`;
    };

    private convertNumberPrice(price: number): string {
        return price
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    private calculateAveragePricePerMeter(data: Property[]): number {
        if (data.length === 0) return 0;
        return data.reduce((acc, x) => acc + x.pricePerMeter, 0) / data.length;
    }

    public getInfoText(): string {
        const data = this.data();
        const pricePerMeter = this.calculateAveragePricePerMeter(data.data);
        return `Średnia cena za metr: ${this.convertNumberPrice(pricePerMeter)} PLN`;
    };

    private calculateMedianPricePerMeter(data: Property[]): number {
        const sortedPrices = data.map(x => x.pricePerMeter).sort((a, b) => a - b);
        const count = sortedPrices.length;

        if (count === 0) return 0;

        if (count % 2 === 1) {
            return sortedPrices[Math.floor(count / 2)];
        } else {
            return (sortedPrices[count / 2 - 1] + sortedPrices[count / 2]) / 2.0;
        }
    }

    private calculateMedianArea(data: Property[]): number {
        const sortedAreas = data.map(x => x.area).sort((a, b) => a - b);
        const count = sortedAreas.length;

        if (count === 0) return 0;

        if (count % 2 === 1) {
            return sortedAreas[Math.floor(count / 2)];
        } else {
            return (sortedAreas[count / 2 - 1] + sortedAreas[count / 2]) / 2.0;
        }
    }

    private calculateAverageFloor(data: Property[]): number {
        if (data.length === 0) return 0;
        return data.reduce((acc, x) => acc + x.floor, 0) / data.length;
    }

    public buildChartData(): ChartConfiguration<'bar'>['data'] {
        const input = this.getDataWithGroupStatistics();
        const labels = Array.from(
            new Set(Object.values(input).flatMap(group => Object.keys(group)))
        );

        const datasets = Object.entries(input).map(([group, values], idx) => ({
            label: group,
            data: labels.map(label => values[label as keyof GroupData]),
            backgroundColor: this.getColor(idx)
        }));

        return {
            labels,
            datasets
        };
    }

    private getColor(idx: number): string {//TODO get only one part of color synchronize
        const palette = [
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];
        return palette[idx % palette.length];
    }

    public filterByParameter = (parameter: string) =>
        computed(() => {
            const datasets = this.buildChartData();
            if (!datasets?.labels) {
                return { datasets: [], labels: [] };
            }
            const index = datasets.labels.indexOf(parameter);
            if (index === -1) {
                return { datasets: [], labels: [] };
            }

            const newDatasets = datasets.datasets.map(ds => ({
                ...ds,
                data: [ds.data[index]],
            }));

            const datas = newDatasets.flatMap(ds => ds.data);
            const labels = newDatasets.map(ds => ds.label);

            return {
                datasets: [
                    { data: datas, label: 'Liczba ofert' }
                ],
                labels
            };
        });
}