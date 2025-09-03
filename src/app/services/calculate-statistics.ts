import { Injectable } from "@angular/core";
import { RealEstateDataService } from './real-estate-data.service';
import { BehaviorSubject, map, Observable, of, tap } from "rxjs";
import { PropertydataAPI } from "../models/property";

@Injectable({ providedIn: 'root' })
export class CalculateStatisticsService {

    private readonly data$ = new BehaviorSubject<PropertydataAPI>({ totalCount: 0, data: [] });
    private loaded = false;

    constructor(private readonly realEstateService: RealEstateDataService) { }


    fetchData(): Observable<PropertydataAPI> {
        return this.realEstateService.getDashboardData().pipe(
            tap(data => {
                this.data$.next(data);
                this.loaded = true;
            })
        );
    }

    getData(): Observable<PropertydataAPI> {
        if (!this.loaded) {
            this.fetchData().subscribe();
        }
        return this.data$.asObservable();
    }

    public getBarChartDataByBuildingType$(groupBy: string = 'buildingType'): Observable<{ datasets: { data: number[], label: string }[], labels: string[] }> {
        return this.getData().pipe(
            map(results => {

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
                    let key = this.getNested(item, groupBy);

                    if (typeof key === 'number') {
                        key = Math.round(key).toString(); // Round and convert to string for grouping
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
                        .map(key => ({ key, value: groupMap.get(key)! }))
                        .sort((a, b) => Number(a.key) - Number(b.key));
                    labels = pairs.map(pair => pair.key);
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
            })
        );
    }

    private getNested(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
    }
}