import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { PagedResult } from '../models/pagedResult';
import { PropertyListItem } from '../models/propertyListItem';
import { PropertyHistory } from '../models/propertyHistory';
import { PropertyQuery } from '../models/propertyQuery';

@Injectable({ providedIn: 'root' })
export class PropertyListService {
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    constructor(private readonly http: HttpClient) { }

    getProperties(params: PropertyQuery): Observable<PagedResult<PropertyListItem>> {
        let httpParams = new HttpParams();

        (Object.keys(params) as (keyof PropertyQuery)[]).forEach(key => {
            const value = params[key];
            if (value !== undefined && value !== null && value !== '') {
                httpParams = httpParams.set(key, String(value));
            }
        });

        return this.http.get<PagedResult<PropertyListItem>>(`${this.apiUrl}/properties`, { params: httpParams });
    }

    getHistory(city: string, url: string): Observable<PropertyHistory> {
        return this.http.get<PropertyHistory>(`${this.apiUrl}/propertyHistory/${encodeURIComponent(city)}`, { params: { url } });
    }
}
