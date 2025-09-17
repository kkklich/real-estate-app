import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../models/property';

@Injectable({ providedIn: 'root' })
export class RealEstateDataService {
    // private readonly apiUrl = 'http://localhost:5016/api/RealEstate'; // replace with your real API URL
    private readonly apiUrl = 'https://olxapi-jwcz.onrender.com/api/RealEstate'; // replace with your real API URL

    constructor(private readonly http: HttpClient) { }

    getDashboardData(): Observable<PropertydataAPI> {
        return this.http.get<PropertydataAPI>(`${this.apiUrl}/getRealEstate`);
    }
}