import { Injectable, signal, computed } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { PropertydataAPI } from "../models/property";

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

    constructor(private readonly realEstateService: RealEstateDataService) { }

    fetchData() {
        this.realEstateService.getDashboardData().subscribe(data => {
            this.data.set(data);
            this.loaded.set(true);
        });
    }

    getData() {
        if (!this.loaded()) {
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
}