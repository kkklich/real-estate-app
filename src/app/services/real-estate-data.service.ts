import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';

@Injectable({ providedIn: 'root' })
export class RealEstateDataService {
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    // Per-city cache: revisiting a city replays the cached response instantly
    // instead of hitting the API again. Entries are dropped on error so a
    // failed request is retried next time instead of replaying the failure.
    private readonly dashboardCache = new Map<cityEnum, Observable<FullDashboard>>();

    constructor(private readonly http: HttpClient) { }

    getFullDashboard(city: cityEnum): Observable<FullDashboard> {
        let cached = this.dashboardCache.get(city);
        if (!cached) {
            cached = this.http.get<FullDashboard>(`${this.apiUrl}/getFullDashboard/${city}`).pipe(
                catchError(err => {
                    this.dashboardCache.delete(city);
                    return throwError(() => err);
                }),
                shareReplay({ bufferSize: 1, refCount: false })
            );
            this.dashboardCache.set(city, cached);
        }
        return cached;
    }
}
