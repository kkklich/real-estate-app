import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RealEstateDataService } from './real-estate-data.service';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';
import { environment } from '../../enviroments/environment';

describe('RealEstateDataService', () => {

    const api = `${environment.apiUrl}/api/RealEstate`;
    const dashboardUrl = (city: cityEnum) => `${api}/getFullDashboard/${city}`;
    const dropsFor = (city: cityEnum) => (url: string) => url === `${api}/getPriceDrops/${city}`;
    const payload = (label: string) => ({ label }) as unknown as FullDashboard;

    let service: RealEstateDataService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(RealEstateDataService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('replays a city it has already loaded instead of requesting it again', () => {
        service.getFullDashboard(cityEnum.Krakow).subscribe();
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush(payload('krakow'));

        let replayed: FullDashboard | undefined;
        service.getFullDashboard(cityEnum.Krakow).subscribe(value => replayed = value);

        http.expectNone(dashboardUrl(cityEnum.Krakow));
        expect(replayed).toEqual(payload('krakow'));
    });

    it('caches each city separately', () => {
        let krakow: FullDashboard | undefined;
        let katowice: FullDashboard | undefined;
        service.getFullDashboard(cityEnum.Krakow).subscribe(value => krakow = value);
        service.getFullDashboard(cityEnum.Katowice).subscribe(value => katowice = value);

        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush(payload('krakow'));
        http.expectOne(dashboardUrl(cityEnum.Katowice)).flush(payload('katowice'));

        expect(krakow).toEqual(payload('krakow'));
        expect(katowice).toEqual(payload('katowice'));
    });

    it('serves map points from the cached dashboard response, without a second request', () => {
        const points = [{ url: 'https://example.com/1' }];
        service.getFullDashboard(cityEnum.Krakow).subscribe();
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush({ mapPoints: points });

        let mapPoints: unknown[] | undefined;
        service.getMapPoints(cityEnum.Krakow).subscribe(value => mapPoints = value);

        http.expectNone(dashboardUrl(cityEnum.Krakow));
        expect(mapPoints).toEqual(points);
    });

    it('reads a dashboard without map points as an empty list', () => {
        let mapPoints: unknown[] | undefined;
        service.getMapPoints(cityEnum.Katowice).subscribe(value => mapPoints = value);
        http.expectOne(dashboardUrl(cityEnum.Katowice)).flush({ mapPoints: null });

        expect(mapPoints).toEqual([]);
    });

    it('sends the price-drop limit as a query parameter', () => {
        service.getPriceDrops(cityEnum.Krakow, 5).subscribe();

        const request = http.expectOne(r => dropsFor(cityEnum.Krakow)(r.url));
        expect(request.request.params.get('limit')).toBe('5');
        request.flush([]);
    });

    it('does not cache a failure, so the next call retries', () => {
        let failure: HttpErrorResponse | undefined;
        service.getFullDashboard(cityEnum.Krakow).subscribe({ error: err => failure = err });
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush('down', { status: 503, statusText: 'Unavailable' });
        expect(failure?.status).toBe(503);

        let retried: FullDashboard | undefined;
        service.getFullDashboard(cityEnum.Krakow).subscribe(value => retried = value);
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush(payload('recovered'));

        expect(retried).toEqual(payload('recovered'));
    });

    // Retry after a *successful* load has to refetch, not replay the cached payload.
    it('refetches both resources for a city after invalidate()', () => {
        service.getFullDashboard(cityEnum.Krakow).subscribe();
        service.getPriceDrops(cityEnum.Krakow).subscribe();
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush(payload('stale'));
        http.expectOne(r => dropsFor(cityEnum.Krakow)(r.url)).flush([]);

        service.invalidate(cityEnum.Krakow);
        let dashboard: FullDashboard | undefined;
        let drops: unknown[] | undefined;
        service.getFullDashboard(cityEnum.Krakow).subscribe(value => dashboard = value);
        service.getPriceDrops(cityEnum.Krakow).subscribe(value => drops = value);
        http.expectOne(dashboardUrl(cityEnum.Krakow)).flush(payload('fresh'));
        http.expectOne(r => dropsFor(cityEnum.Krakow)(r.url)).flush([{ title: 'new drop' }]);

        expect(dashboard).toEqual(payload('fresh'));
        expect(drops).toEqual([{ title: 'new drop' }]);
    });
});
