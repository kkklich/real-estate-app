import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { Subject } from 'rxjs';
import { CalculateStatisticsService } from './calculate-statistics';
import { RealEstateDataService } from './real-estate-data.service';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';
import { PriceDrop } from '../models/priceDrop';

/** Hands out one controllable Subject per request, so a test decides when each answers. */
class FakeRealEstateData {
    readonly dashboards: { city: cityEnum; response: Subject<FullDashboard> }[] = [];
    readonly drops: { city: cityEnum; response: Subject<PriceDrop[]> }[] = [];
    readonly invalidated: cityEnum[] = [];

    getFullDashboard(city: cityEnum) {
        const response = new Subject<FullDashboard>();
        this.dashboards.push({ city, response });
        return response;
    }

    getPriceDrops(city: cityEnum) {
        const response = new Subject<PriceDrop[]>();
        this.drops.push({ city, response });
        return response;
    }

    invalidate(city: cityEnum): void {
        this.invalidated.push(city);
    }
}

const dashboardFor = (label: string) =>
    ({ charts: { label }, insights: { label }, mapPoints: [] }) as unknown as FullDashboard;

describe('CalculateStatisticsService', () => {

    let fake: FakeRealEstateData;

    function create(platform: 'browser' | 'server' = 'browser'): CalculateStatisticsService {
        fake = new FakeRealEstateData();
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: PLATFORM_ID, useValue: platform },
                { provide: RealEstateDataService, useValue: fake }
            ]
        });
        const service = TestBed.inject(CalculateStatisticsService);
        TestBed.tick();
        return service;
    }

    beforeEach(() => spyOn(console, 'error'));

    it('loads the default city and exposes its charts, insights and map points', () => {
        const service = create();

        expect(fake.dashboards.map(d => d.city)).toEqual([cityEnum.Krakow]);
        expect(service.dashboard.loading()).toBeTrue();

        fake.dashboards[0].response.next(dashboardFor('krakow'));

        expect(service.dashboard.loading()).toBeFalse();
        expect(service.dashboard.settled()).toBeTrue();
        expect(service.charts()).toEqual(dashboardFor('krakow').charts);
        expect(service.insights()).toEqual(dashboardFor('krakow').insights);
        expect(service.mapPoints()).toEqual([]);
    });

    // Review finding 1a: a failed request used to be indistinguishable from "still loading".
    it('turns a failed dashboard request into an error, not an endless loading state', () => {
        const service = create();

        fake.dashboards[0].response.error(new Error('boom'));

        expect(service.dashboard.loading()).toBeFalse();
        expect(service.dashboard.error()).toBe('Could not load the dashboard.');
        expect(service.charts()).toBeNull();
    });

    // Review finding 1b: a failed price-drops request used to become [] - "no price drops".
    it('reports failed price drops as an error rather than as an empty list', () => {
        const service = create();

        fake.drops[0].response.error(new Error('boom'));

        expect(service.priceDrops.error()).toBe('Could not load price drops.');
        expect(service.priceDrops.data()).toBeNull();
    });

    it('loads price drops independently of the dashboard', () => {
        const service = create();

        fake.drops[0].response.next([]);

        expect(service.priceDrops.data()).toEqual([]);
        expect(service.dashboard.loading()).toBeTrue();
    });

    it('cancels the request for a city the user has already left', () => {
        const service = create();
        const krakow = fake.dashboards[0];

        service.city.set(cityEnum.Katowice);
        TestBed.tick();

        expect(krakow.response.observed).withContext('Krakow request should be unsubscribed').toBeFalse();
        expect(fake.dashboards[1].city).toBe(cityEnum.Katowice);

        fake.dashboards[1].response.next(dashboardFor('katowice'));
        expect(service.charts()).toEqual(dashboardFor('katowice').charts);
    });

    it('clears the previous city while the next one loads', () => {
        const service = create();
        fake.dashboards[0].response.next(dashboardFor('krakow'));

        service.city.set(cityEnum.Katowice);
        TestBed.tick();

        expect(service.charts()).toBeNull();
        expect(service.dashboard.loading()).toBeTrue();
        expect(service.dashboard.settled()).withContext('a refresh is not a first load').toBeTrue();
    });

    it('reload() invalidates the cache for the current city and requests both resources again', () => {
        const service = create();
        fake.dashboards[0].response.error(new Error('boom'));

        service.reload();
        TestBed.tick();

        expect(fake.invalidated).toEqual([cityEnum.Krakow]);
        expect(fake.dashboards.length).toBe(2);
        expect(fake.drops.length).toBe(2);
        expect(service.dashboard.loading()).toBeTrue();
    });

    // Review finding 3: prerendering froze whatever the build machine got back into static HTML.
    it('never calls the API while rendering on the server', () => {
        const service = create('server');

        expect(fake.dashboards.length).toBe(0);
        expect(fake.drops.length).toBe(0);
        expect(service.dashboard.loading()).toBeTrue();
        expect(service.dashboard.settled()).toBeFalse();
    });
});
