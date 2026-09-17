import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';
import { MapPoint } from '../models/mapPoint';
import { PriceDrop } from '../models/priceDrop';

@Injectable({ providedIn: 'root' })
export class RealEstateDataService {

    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    // Per-city cache: revisiting a city replays the cached response instantly
    // instead of hitting the API again. Entries are dropped on error so a
    // failed request is retried next time instead of replaying the failure.
    private readonly dashboardCache = new Map<cityEnum, Observable<FullDashboard>>();
    private readonly priceDropsCache = new Map<cityEnum, Observable<PriceDrop[]>>();

    getFullDashboard(city: cityEnum): Observable<FullDashboard> {
        return this.cached(
            this.dashboardCache,
            city,
            () => this.http.get<FullDashboard>(`${this.apiUrl}/getFullDashboard/${city}`)
        );
    }

    /**
     * The current offers of a city, as the map plots them. Read from the dashboard response
     * rather than getMapPoints/{city}: the points are nearly all of that payload anyway,
     * and sharing its cache makes a map the dashboard already loaded open instantly.
     */
    getMapPoints(city: cityEnum): Observable<MapPoint[]> {
        return this.getFullDashboard(city).pipe(map(dashboard => dashboard.mapPoints ?? []));
    }

    getPriceDrops(city: cityEnum, limit = 20): Observable<PriceDrop[]> {
        return this.cached(
            this.priceDropsCache,
            city,
            () => this.http.get<PriceDrop[]>(`${this.apiUrl}/getPriceDrops/${city}`, {
                params: new HttpParams().set('limit', limit)
            })
        );
    }

    /**
     * Forgets both cached responses for a city. Without this a "Retry" after a
     * *successful* load would replay the cached payload instead of refetching.
     */
    invalidate(city: cityEnum): void {
        this.dashboardCache.delete(city);
        this.priceDropsCache.delete(city);
    }

    private cached<T>(
        cache: Map<cityEnum, Observable<T>>,
        city: cityEnum,
        request: () => Observable<T>
    ): Observable<T> {
        let entry = cache.get(city);
        if (!entry) {
            entry = request().pipe(
                catchError((err: unknown) => {
                    cache.delete(city);
                    return throwError(() => err);
                }),
                shareReplay({ bufferSize: 1, refCount: false })
            );
            cache.set(city, entry);
        }
        return entry;
    }
}
