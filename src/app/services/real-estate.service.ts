import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RealEstateService {
    private readonly apiUrl = 'http://localhost:5016/api/RealEstate'; // replace with your real API URL

    constructor(private readonly http: HttpClient) { }

    // getDashboardData(): void {
    //     // return this.http.get<any>(`${this.apiUrl}/dashboard`);
    // }
    getDashboardData(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/getRealEstate`);
    }
    // Add more methods as needed for filters, etc.
}