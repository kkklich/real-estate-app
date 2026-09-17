import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { Subject } from 'rxjs';
import { CalculateStatisticsService } from './calculate-statistics';
import { RealEstateDataService } from './real-estate-data.service';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';
import { MapPoint } from '../models/mapPoint';
import { PriceDrop } from '../models/priceDrop';

/** Hands out one controllable Subject per request, so a test decides when each answers. */
class FakeRealEstateData {
    readonly dashboards: { city: cityEnum; response: Subject<FullDashboard> }[] = [];
    readonly drops: { city: cityEnum; response: Subject<PriceDrop[]> }[] = [];
    readonly mapPoints: { city: cityEnum; response: Subject<MapPoint[]> }[] = [];
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

    getMapPoints(city: cityEnum) {
        const response = new Subject<MapPoint[]>();
        this.mapPoints.push({ city, response });
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

    it('loads the default city and exposes its charts and insights', () => {
        const service = create();

        expect(fake.dashboards.map(d => d.city)).toEqual([cityEnum.Krakow]);
        expect(service.dashboard.loading()).toBeTrue();

        fake.dashboards[0].response.next(dashboardFor('krakow'));

        expect(service.dashboard.loading()).toBeFalse();
        expect(service.dashboard.settled()).toBeTrue();
        expect(service.charts()).toEqual(dashboardFor('krakow').charts);
        expect(service.insights()).toEqual(dashboardFor('krakow').insights);
    });

    // The map offers are by far the biggest response the API serves; a dashboard whose map
    // nobody opens must not download them.
    it('does not request the map offers until a map is opened', () => {
        const service = create();
        fake.dashboards[0].response.next(dashboardFor('krakow'));

        service.city.set(cityEnum.Katowice);
        TestBed.tick();

        expect(fake.mapPoints.length).toBe(0);
        expect(service.mapPoints.data()).toBeNull();
    });

    it('requests the map offers once a map is opened, then follows the city', () => {
        const service = create();
        const points = [{ title: 'an offer' }] as unknown as MapPoint[];

        service.requestMapPoints();
        TestBed.tick();

        expect(fake.mapPoints.map(m => m.city)).toEqual([cityEnum.Krakow]);
        fake.mapPoints[0].response.next(points);
        expect(service.mapPoints.data()).toEqual(points);

        service.city.set(cityEnum.Katowice);
        TestBed.tick();

        expect(fake.mapPoints.map(m => m.city)).toEqual([cityEnum.Krakow, cityEnum.Katowice]);
        expect(service.mapPoints.loading()).withContext('the previous city stays off the map').toBeTrue();
    });

    it('reports a failed map request as an error, and retries it on demand', () => {
        const service = create();
        service.requestMapPoints();
        TestBed.tick();

        fake.mapPoints[0].response.error(new Error('boom'));

        expect(service.mapPoints.error()).toBe('Could not load the map.');

        service.reloadMapPoints();
        TestBed.tick();

        expect(fake.mapPoints.length).toBe(2);
        expect(fake.dashboards.length).withContext('a map retry must not refetch the page').toBe(1);
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
