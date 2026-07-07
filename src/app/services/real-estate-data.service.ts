import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../models/property';
import { environment } from '../../enviroments/environment';
import { cityEnum } from '../models/enums/city.enum';
import { MarketInsights } from '../models/marketInsights';
import { DashboardCharts } from '../models/dashboardCharts';
import { MapPoint } from '../models/mapPoint';

@Injectable({ providedIn: 'root' })
export class RealEstateDataService {
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    constructor(private readonly http: HttpClient) { }

    getDashboardData(city: cityEnum): Observable<PropertydataAPI> {
        return this.http.get<PropertydataAPI>(`${this.apiUrl}/getRealEstate/${city}`);
    }
    loadDataMarkeplaces(): Observable<PropertydataAPI> {
        return this.http.get<PropertydataAPI>(`${this.apiUrl}/loadDataMarkeplaces`);
    }

    getDashboardCharts(city: cityEnum): Observable<DashboardCharts> {
        return this.http.get<DashboardCharts>(`${this.apiUrl}/getDashboardCharts/${city}`);
    }

    getMarketInsights(city: cityEnum): Observable<MarketInsights> {
        return this.http.get<MarketInsights>(`${this.apiUrl}/getMarketInsights/${city}`);
    }

    getMapPoints(city: cityEnum): Observable<MapPoint[]> {
        return this.http.get<MapPoint[]>(`${this.apiUrl}/getMapPoints/${city}`);
    }
}
