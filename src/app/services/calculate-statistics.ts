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

    public getBarChartDataByBuildingType$(): Observable<{ datasets: { data: number[], label: string }[], labels: string[] }> {
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
                    const key = item.buildingType || 'Unknown';
                    groupMap.set(key, (groupMap.get(key) || 0) + 1);
                });

                const labels = Array.from(groupMap.keys());
                const counts = Array.from(groupMap.values());
                return {
                    datasets: [
                        { data: counts, label: 'Liczba ofert' }
                    ],
                    labels
                };
            })
        );
    }
}