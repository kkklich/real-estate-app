import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../models/property';
import { environment } from '../../enviroments/environment';
import { timelinePriceDto } from '../models/timelinePriceDto';
import { cityEnum } from '../models/enums/city.enum';
import { BarChartData } from '../models/barChartData';

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

    getTimeLinePrice(city: cityEnum): Observable<timelinePriceDto[]> {
        return this.http.get<timelinePriceDto[]>(`${this.apiUrl}/getTimelinePrice/${city}`);
    }

    getGroupedStatistics(groupedBy: string, city: cityEnum): Observable<BarChartData> {
        return this.http.get<BarChartData>(`${this.apiUrl}/getGroupedStatistics/${groupedBy}/${city}`);
    }

    filterByParameter(groupBy: string, city: cityEnum, parameter: string): Observable<BarChartData> {
        return this.http.get<BarChartData>(`${this.apiUrl}/filterByParameter/${groupBy}/${city}/${encodeURIComponent(parameter)}`);
    }
}