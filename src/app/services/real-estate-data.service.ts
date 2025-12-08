import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../models/property';
import { environment } from '../../enviroments/environment';
import { timelinePriceDto } from '../models/timelinePriceDto';
import { cityEnum } from '../models/enums/city.enum';

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
}