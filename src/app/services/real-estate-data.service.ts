import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../models/property';
import { environment } from '../../enviroments/environment';

@Injectable({ providedIn: 'root' })
export class RealEstateDataService {
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    constructor(private readonly http: HttpClient) { }

    getDashboardData(): Observable<PropertydataAPI> {
        return this.http.get<PropertydataAPI>(`${this.apiUrl}/getRealEstate`);
    }
}