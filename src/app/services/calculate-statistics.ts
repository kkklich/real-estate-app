import { effect, Signal } from "@angular/core";
import { Injectable, signal, computed } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { Property, PropertydataAPI } from "../models/property";
import { RealEstateStatistics } from "../models/resultStatistics";

@Injectable({ providedIn: 'root' })

export class CalculateStatisticsService {
    private readonly data = signal<PropertydataAPI>({ totalCount: 0, data: [] });
    private readonly loaded = signal(false);
    public groupedBy = signal<string>('market');

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
        this.listenToSignal(this.groupedBy, (newValue) => {
            this.getDataWithGroupStatistics(newValue);
        });
    }

    public listenToSignal<T>(signal: Signal<T>, callback: (value: T) => void): void {
        effect(() => {
            callback(signal());
        });
    }

    private fetchData() {
        this.realEstateService.getDashboardData().subscribe(data => {
            this.data.set(data);
        });
    }

    getData() {
        if (!this.loaded()) {
            this.loaded.set(true);
            this.fetchData();
        }
        return this.data;
    }

    public barChartDataByBuildingType = computed(() => {
        const results = this.data();
        const groupedBy = this.groupedBy();
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
            const pairs = keys
                .map(key => ({ key, value: groupMap.get(key.toString())! }))
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

    public getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }

    public async getDataWithGroupStatistics(groupByProperty: string = 'market'): Promise<Record<any, RealEstateStatistics>> {
        const response = this.data();
        const propertyParts = groupByProperty.split('.');

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

    private calculateAveragePricePerMeter(data: Property[]): number {
        if (data.length === 0) return 0;
        return data.reduce((acc, x) => acc + x.pricePerMeter, 0) / data.length;
    }

    private calculateMedianPrice(data: Property[]): number {
        const sortedPrices = data.map(x => x.price).sort((a, b) => a - b);
        const count = sortedPrices.length;

        if (count === 0) return 0;

        if (count % 2 === 1) {
            return sortedPrices[Math.floor(count / 2)];
        } else {
            return (sortedPrices[count / 2 - 1] + sortedPrices[count / 2]) / 2.0;
        }
    }

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

    private calculatePriceStandardDeviation(data: Property[]): number {
        if (data.length === 0) return 0;
        const avg = this.calculateAveragePrice(data);
        const sumSquares = data.reduce((acc, x) => acc + Math.pow(x.price - avg, 2), 0);
        return Math.sqrt(sumSquares / data.length);
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
}