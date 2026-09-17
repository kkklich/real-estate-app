import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAppIcons } from '../../../app-icons';
import { PropertiesListComponent } from './properties-list.component';
import { PagedResult } from '../../../models/pagedResult';
import { PropertyListItem } from '../../../models/propertyListItem';
import { FullDashboard } from '../../../models/fullDashboard';
import { MapPoint } from '../../../models/mapPoint';

describe('PropertiesListComponent', () => {

    let http: HttpTestingController;

    function render(platform: 'browser' | 'server' = 'browser') {
        TestBed.configureTestingModule({
            imports: [PropertiesListComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideRouter([]),
                provideAppIcons(),
                { provide: PLATFORM_ID, useValue: platform }
            ],
            // The map's @defer block stays unrendered: a real MapLibre map needs WebGL and
            // fetches its style from MapTiler, neither of which belongs in a unit test.
            deferBlockBehavior: DeferBlockBehavior.Manual
        });
        http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(PropertiesListComponent);
        fixture.detectChanges();
        TestBed.tick();
        return { fixture, component: fixture.componentInstance };
    }

    const pending = (): TestRequest[] => http.match(r => r.url.endsWith('/api/RealEstate/properties'));
    const only = (): TestRequest => {
        const requests = pending();
        expect(requests.length).withContext('open properties requests').toBe(1);
        return requests[0];
    };

    const page = (title: string): PagedResult<PropertyListItem> => ({
        items: [{ id: title, title, url: `https://example.com/${title}` } as PropertyListItem],
        totalCount: 1, page: 1, pageSize: 10, totalPages: 1
    });

    /**
     * Open dashboard requests - the map reads its offers from them - for one city or all.
     * Like pending(), it takes the requests it returns off the open list.
     */
    const dashboards = (city?: string): TestRequest[] =>
        http.match(r => r.url.includes('/api/RealEstate/getFullDashboard/') && (!city || r.url.endsWith(`/${city}`)));

    const offer = (title: string, overrides: Partial<MapPoint> = {}): MapPoint => ({
        url: `https://example.com/${title}`, title, price: 500_000, pricePerMeter: 10_000, floor: 1,
        market: 'Wtórny', buildingType: 'blok', area: 50, private: false, color: '',
        location: { lat: 50.06, lon: 19.94, district: 'Stare Miasto' },
        ...overrides
    });

    const dashboard = (...mapPoints: MapPoint[]) => ({ mapPoints }) as unknown as FullDashboard;

    const mapTitles = (component: PropertiesListComponent) => component.mapMatches()?.map(p => p.title);

    /** Applies a city filter and answers the list request it causes. */
    function applyCity(component: PropertiesListComponent, city: string): void {
        component.city.set(city);
        component.applyFilters();
        TestBed.tick();
        only().flush(page(city));
    }

    beforeEach(() => spyOn(console, 'error'));
    afterEach(() => http.verify());

    it('requests the first page, newest first', () => {
        render();

        const request = only();
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.params.get('sortBy')).toBe('lastSeen');
        expect(request.request.params.get('sortDir')).toBe('desc');
        request.flush(page('x'));
    });

    // Review finding 2b: the slower first response could land last and overwrite the newer sort.
    it('cancels the in-flight request when the sort changes, so only the latest result is shown', () => {
        const { component } = render();
        const first = only();

        component.sortByColumn('price');
        TestBed.tick();

        expect(first.cancelled).withContext('first request cancelled').toBeTrue();
        const second = only();
        expect(second.request.params.get('sortBy')).toBe('price');
        expect(second.request.params.get('sortDir')).toBe('asc');

        second.flush(page('sorted-by-price'));
        expect(component.properties.data()?.items[0].title).toBe('sorted-by-price');
    });

    it('sorting and paging keep the applied filters but ignore ones not yet applied', () => {
        const { component } = render();
        only().flush(page('initial'));

        component.city.set('Krakow');
        component.sortByColumn('price');
        TestBed.tick();
        const sorted = only();
        expect(sorted.request.params.has('city')).withContext('unapplied filter leaked').toBeFalse();
        sorted.flush(page('a'));

        component.applyFilters();
        TestBed.tick();
        const applied = only();
        expect(applied.request.params.get('city')).toBe('Krakow');
        applied.flush(page('b'));

        component.onPage({ pageIndex: 1, pageSize: 25, length: 100 });
        TestBed.tick();
        const paged = only();
        expect(paged.request.params.get('city')).toBe('Krakow');
        expect(paged.request.params.get('page')).toBe('2');
        expect(paged.request.params.get('pageSize')).toBe('25');
        paged.flush(page('c'));
    });

    it('shows a failure as an error, and retry re-sends the same query', () => {
        const { component } = render();

        only().flush('down', { status: 503, statusText: 'Unavailable' });
        expect(component.properties.error()).toBe('The server failed while loading properties. Try again in a moment.');

        component.retry();
        TestBed.tick();

        const retried = only();
        expect(retried.request.params.get('sortBy')).toBe('lastSeen');
        retried.flush(page('retried'));
        expect(component.properties.error()).toBeNull();
    });

    it('announces the current sort to screen readers', () => {
        const { component } = render();
        only().flush(page('x'));

        component.sortByColumn('price');
        TestBed.tick();
        expect(component.ariaSort('price')).toBe('ascending');
        expect(component.ariaSort('area')).toBe('none');
        only().flush(page('y'));

        component.sortByColumn('price');
        TestBed.tick();
        expect(component.ariaSort('price')).toBe('descending');
        only().flush(page('z'));
    });

    // Review finding 3: prerendering baked "Failed to load properties." into the static HTML.
    it('does not call the API while rendering on the server', () => {
        const { component } = render('server');

        expect(pending().length).toBe(0);
        expect(component.properties.loading()).toBeTrue();

        component.toggleMap();
        TestBed.tick();
        expect(dashboards().length).withContext('map requests on the server').toBe(0);
    });

    describe('map', () => {

        it('loads nothing until opened, then loads every city while "All" is applied', () => {
            const { component } = render();
            only().flush(page('x'));
            expect(dashboards().length).withContext('requests before opening').toBe(0);

            component.toggleMap();
            TestBed.tick();

            const requests = dashboards();
            const cityOf = (request: TestRequest) => request.request.url.split('/').pop();
            expect(requests.map(cityOf)).toEqual(jasmine.arrayWithExactContents(['Katowice', 'Krakow']));
            requests.forEach(request => request.flush(dashboard(offer(`in ${cityOf(request)}`))));

            expect(mapTitles(component)).toEqual(jasmine.arrayWithExactContents(['in Katowice', 'in Krakow']));
        });

        it('requests only the applied city and plots the offers the applied filters select', () => {
            const { component } = render();
            only().flush(page('initial'));
            component.market.set('primary');
            applyCity(component, 'Krakow');

            component.toggleMap();
            TestBed.tick();
            expect(dashboards('Katowice').length).withContext('Katowice requests').toBe(0);
            dashboards('Krakow')[0].flush(dashboard(
                offer('primary', { market: 'Pierwotny' }),
                offer('secondary', { market: 'Wtórny' })
            ));
            expect(mapTitles(component)).toEqual(['primary']);

            // Typed but not applied: like the table, the map keeps to the applied filters.
            component.market.set('secondary');
            TestBed.tick();
            expect(mapTitles(component)).toEqual(['primary']);

            component.applyFilters();
            TestBed.tick();
            only().flush(page('secondary'));
            expect(mapTitles(component)).toEqual(['secondary']);
            expect(dashboards().length).withContext('refetched for a filter the client applies').toBe(0);
        });

        it('switches to the newly applied city', () => {
            const { component } = render();
            only().flush(page('initial'));
            applyCity(component, 'Krakow');
            component.toggleMap();
            TestBed.tick();
            dashboards('Krakow')[0].flush(dashboard(offer('in Krakow')));

            applyCity(component, 'Katowice');

            expect(component.mapPoints.loading()).toBeTrue();
            dashboards('Katowice')[0].flush(dashboard(offer('in Katowice')));
            expect(mapTitles(component)).toEqual(['in Katowice']);
        });

        // A new offer array makes the map frame itself again, throwing away the user's pan and zoom.
        it('hands the map the same offers while the table is sorted, paged or reloaded', () => {
            const { component } = render();
            only().flush(page('initial'));
            component.toggleMap();
            TestBed.tick();
            dashboards().forEach(request => request.flush(dashboard(offer(request.request.url))));
            const before = component.mapMatches();
            expect(before?.length).toBe(2);

            component.sortByColumn('price');
            TestBed.tick();
            only().flush(page('sorted'));
            component.onPage({ pageIndex: 1, pageSize: 10, length: 20 });
            TestBed.tick();
            only().flush(page('paged'));
            component.retry();
            TestBed.tick();
            only().flush(page('retried'));
            component.applyFilters();
            TestBed.tick();
            only().flush(page('reapplied'));

            expect(dashboards().length).withContext('map requests').toBe(0);
            expect(component.mapMatches()).toBe(before);
        });

        it('shows a failed load as an error, and retry requests it again', () => {
            const { component } = render();
            only().flush(page('initial'));
            applyCity(component, 'Krakow');
            component.toggleMap();
            TestBed.tick();

            dashboards('Krakow')[0].flush('down', { status: 503, statusText: 'Unavailable' });
            expect(component.mapPoints.error()).toBe('The server failed while loading the map. Try again in a moment.');
            expect(component.mapMatches()).toBeNull();

            component.retryMap();
            TestBed.tick();
            dashboards('Krakow')[0].flush(dashboard(offer('recovered')));

            expect(component.mapPoints.error()).toBeNull();
            expect(mapTitles(component)).toEqual(['recovered']);
        });

        it('opens and closes a panel that says how many offers it plots', async () => {
            const { fixture } = render();
            only().flush(page('initial'));
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;
            const toggle = el.querySelector<HTMLButtonElement>('.map-toggle')!;
            const summary = () => el.querySelector('.map-summary')?.textContent?.replace(/\s+/g, ' ').trim();

            expect(toggle.textContent).toContain('Show on map');
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
            expect(toggle.hasAttribute('aria-controls')).withContext('controls a panel that is not there').toBeFalse();
            expect(el.querySelector('#properties-map')).toBeNull();

            toggle.click();
            fixture.detectChanges();
            expect(toggle.textContent).toContain('Hide map');
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
            expect(toggle.getAttribute('aria-controls')).toBe('properties-map');
            expect(el.querySelector('#properties-map [role="status"]')?.textContent).toContain('Loading the map');

            dashboards().forEach(request => request.flush(dashboard(
                offer(`${request.request.url} cheap`, { price: 300_000 }),
                offer(`${request.request.url} dear`, { price: 900_000 })
            )));
            fixture.detectChanges();
            expect(summary()).toBe('4 offers from the latest scrape match the applied filters. '
                + 'Older listings and offers without a location are not on the map.');
            expect((await fixture.getDeferBlocks()).length).withContext('map blocks with offers').toBe(1);

            fixture.componentInstance.priceMax.set(1);
            fixture.componentInstance.applyFilters();
            fixture.detectChanges();
            only().flush(page('none'));
            fixture.detectChanges();
            expect(summary()).toContain('0 offers from the latest scrape match the applied filters.');
            expect((await fixture.getDeferBlocks()).length).withContext('map blocks without offers').toBe(0);

            toggle.click();
            fixture.detectChanges();
            expect(toggle.textContent).toContain('Show on map');
            expect(el.querySelector('#properties-map')).toBeNull();
        });
    });
});
