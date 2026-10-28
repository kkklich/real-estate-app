import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { Location, formatDate } from '@angular/common';
import { SpyLocation, provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideAppIcons } from '../../../app-icons';
import { PropertiesListComponent } from './properties-list.component';
import { PagedResult } from '../../../models/pagedResult';
import { PropertyListItem } from '../../../models/propertyListItem';
import { MapPoint } from '../../../models/mapPoint';
import { RealEstateDataService } from '../../../services/real-estate-data.service';

describe('PropertiesListComponent', () => {

    let http: HttpTestingController;

    function configure(platform: 'browser' | 'server') {
        TestBed.configureTestingModule({
            imports: [PropertiesListComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideRouter([]),
                // The page writes its query to the URL; a real Location would rewrite the
                // address of the page Karma runs the specs in.
                provideLocationMocks(),
                provideAppIcons(),
                { provide: PLATFORM_ID, useValue: platform }
            ],
            // The map's @defer block stays unrendered: a real MapLibre map needs WebGL and
            // fetches its style from MapTiler, neither of which belongs in a unit test.
            deferBlockBehavior: DeferBlockBehavior.Manual
        });
        http = TestBed.inject(HttpTestingController);
    }

    function create() {
        const fixture = TestBed.createComponent(PropertiesListComponent);
        fixture.detectChanges();
        TestBed.tick();
        return { fixture, component: fixture.componentInstance };
    }

    function render(platform: 'browser' | 'server' = 'browser') {
        configure(platform);
        return create();
    }

    /** Opens the page at a URL, as a reload or a shared link does. */
    async function renderAt(url: string) {
        configure('browser');
        await TestBed.inject(Router).navigateByUrl(url);
        return create();
    }

    const location = () => TestBed.inject(Location) as SpyLocation;

    /** The query string in the address bar, as name/value pairs. */
    const urlParams = (): Record<string, string> =>
        Object.fromEntries(new URLSearchParams(location().path().split('?')[1] ?? ''));

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
     * Open requests for the map's offers, for one city or all. Like pending(), it takes
     * the requests it returns off the open list.
     */
    const mapRequests = (city?: string): TestRequest[] =>
        http.match(r => r.url.includes('/api/RealEstate/getMapPoints/') && (!city || r.url.endsWith(`/${city}`)));

    const offer = (title: string, overrides: Partial<MapPoint> = {}): MapPoint => ({
        url: `https://example.com/${title}`, title, price: 500_000, pricePerMeter: 10_000, floor: 1,
        market: 'Wtórny', buildingType: 'blok', area: 50, private: false,
        location: { lat: 50.06, lon: 19.94, district: 'Stare Miasto' },
        ...overrides
    });

    const mapOffers = (...offers: MapPoint[]) => offers;

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

    it('applies a URL from the filter input and keeps it through sorting and paging until cleared', async () => {
        const { fixture, component } = render();
        only().flush(page('initial'));
        const url = 'https://www.olx.pl/d/oferta/loft-IDABC.html?ref=search&x=100%25#photos';
        const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[aria-label="Filter by Property URL"]')!;
        input.value = '  ' + url + '  ';
        input.dispatchEvent(new Event('input'));
        component.city.set('Krakow');
        component.website.set('0');
        TestBed.tick();
        expect(pending().length).toBe(0);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        TestBed.tick();
        const applied = only();
        expect(applied.request.params.get('url')).toBe(url);
        expect(new URL(applied.request.urlWithParams, 'https://example.test').searchParams.get('url')).toBe(url);
        expect(applied.request.params.get('page')).toBe('1');
        expect(applied.request.params.get('city')).toBe('Krakow');
        expect(applied.request.params.get('webName')).toBe('0');
        applied.flush(page('matching'));
        component.mapPoints.succeed([offer('matching', { url }), offer('other')]);
        expect(mapTitles(component)).toEqual(['matching']);
        await fixture.whenStable();
        expect(urlParams()['url']).toBe(url);
        component.url.set('not-applied');
        component.sortByColumn('price');
        TestBed.tick();
        const sorted = only();
        expect(sorted.request.params.get('url')).toBe(url);
        sorted.flush(page('sorted'));
        component.onPage({ pageIndex: 1, pageSize: 25, length: 100 });
        TestBed.tick();
        const paged = only();
        expect(paged.request.params.get('url')).toBe(url);
        expect(paged.request.params.get('page')).toBe('2');
        paged.flush(page('paged'));
        component.clearFilters();
        TestBed.tick();
        const cleared = only();
        expect(cleared.request.params.has('url')).toBeFalse();
        expect(component.url()).toBe('');
        expect(component.hasFilters()).toBeFalse();
        cleared.flush(page('all'));
    });

    it('restores a URL search from a shared link including reserved URL characters', async () => {
        const url = 'https://www.olx.pl/d/oferta/loft-IDABC.html?ref=search&x=100%25#photos';
        const { fixture, component } = await renderAt('/?url=' + encodeURIComponent(url) + '&page=3');
        const request = only();
        expect(request.request.params.get('url')).toBe(url);
        expect(request.request.params.get('page')).toBe('3');
        expect(component.url()).toBe(url);
        request.flush(page('matching'));
        fixture.detectChanges();
        const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[aria-label="Filter by Property URL"]')!;
        expect(input.value).toBe(url);
        expect(component.hasFilters()).toBeTrue();
        await fixture.whenStable();
        expect(urlParams()['url']).toBe(url);
    });

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

    describe('column filters', () => {

        it('sends every column filter, and keeps them through a sort', () => {
            const { component } = render();
            only().flush(page('initial'));

            component.title.set('kawalerka');
            component.district.set('Podgorze');
            component.market.set('primary');
            component.pricePerMeterMin.set('12000');
            component.floorMin.set('1');
            component.floorMax.set('3');
            // Everything the price has dropped by at least 10k: an upper bound below zero.
            component.priceChangeMax.set('-10000');
            component.snapshotCountMin.set('2');
            component.applyFilters();
            TestBed.tick();

            const applied = only();
            const sent = (key: string) => applied.request.params.get(key);
            expect(sent('title')).toBe('kawalerka');
            expect(sent('district')).toBe('Podgorze');
            expect(sent('market')).toBe('primary');
            expect(sent('pricePerMeterMin')).toBe('12000');
            expect(sent('floorMin')).toBe('1');
            expect(sent('floorMax')).toBe('3');
            expect(sent('priceChangeMax')).toBe('-10000');
            expect(sent('snapshotCountMin')).toBe('2');
            applied.flush(page('filtered'));

            component.sortByColumn('priceChange');
            TestBed.tick();
            const sorted = only();
            expect(sorted.request.params.get('sortBy')).toBe('priceChange');
            expect(sorted.request.params.get('priceChangeMax')).withContext('filter lost on sort').toBe('-10000');
            sorted.flush(page('sorted'));
        });

        // A box holding only "-" or "1e" is on its way to a number, not a bound yet.
        it('leaves out a bound that is empty or not a number', () => {
            const { component } = render();
            only().flush(page('initial'));

            component.priceMin.set('  ');
            component.priceChangeMax.set('-');
            component.areaMin.set('40');
            component.applyFilters();
            TestBed.tick();

            const applied = only();
            expect(applied.request.params.has('priceMin')).toBeFalse();
            expect(applied.request.params.has('priceChangeMax')).toBeFalse();
            expect(applied.request.params.get('areaMin')).toBe('40');
            applied.flush(page('filtered'));
        });

        it('empties every filter at once, and applies that', () => {
            const { component } = render();
            only().flush(page('initial'));
            expect(component.hasFilters()).toBeFalse();

            component.search.set('osiedle');
            component.city.set('Krakow');
            component.priceMax.set('500000');
            component.applyFilters();
            TestBed.tick();
            expect(component.hasFilters()).toBeTrue();
            only().flush(page('filtered'));

            component.clearFilters();
            TestBed.tick();

            const cleared = only();
            for (const key of ['search', 'city', 'priceMax']) {
                expect(cleared.request.params.has(key)).withContext(`${key} survived Clear`).toBeFalse();
            }
            expect(component.hasFilters()).toBeFalse();
            expect(component.search()).toBe('');
            expect(component.priceMax()).toBe('');
            cleared.flush(page('all'));
        });

        // Filters remain mounted while rows are loading.
        it('keeps the header and the filter panel mounted while the request is in flight', () => {
            const { fixture, component } = render();
            only().flush(page('x'));
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;
            const header = el.querySelector('thead');

            component.title.set('loft');
            component.applyFilters();
            fixture.detectChanges();

            expect(component.properties.loading()).toBeTrue();
            expect(el.querySelector('thead')).withContext('header torn down').toBe(header);
            expect(el.querySelector<HTMLInputElement>('.filter-grid [aria-label="Filter by Title"]')?.value).toBe('loft');
            expect(el.querySelector('.state-row .state-cell')).withContext('spinner row').not.toBeNull();
            expect(el.querySelectorAll('tbody tr:not(.state-row)').length).toBe(0);

            only().flush(page('loft'));
            fixture.detectChanges();
            expect(el.querySelector('.state-row')).toBeNull();
            expect(el.querySelectorAll('tbody tr').length).toBe(1);
        });

        it('renders filters above the table, and applies what is typed into one', () => {
            const { fixture, component } = render();
            only().flush(page('x'));
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;

            expect(el.querySelectorAll('thead .sort-btn').length).toBe(component.columns.length);
            const filtered = component.filters.filter(col => col.filter !== 'none').length;
            const ranges = component.filters.filter(col => col.filter === 'range').length;
            expect(el.querySelectorAll('.filter-grid .col-filter').length).toBe(filtered + ranges);
            expect(el.querySelectorAll('.filter-field').length).toBe(filtered);
            expect(el.querySelector('.filter-row')).toBeNull();
            expect(el.querySelector('.filters')!.compareDocumentPosition(el.querySelector('table')!)
                & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

            const titleBox = el.querySelector<HTMLInputElement>('.filter-grid .col-filter')!;
            expect(titleBox.getAttribute('aria-label')).toBe('Filter by Title');
            titleBox.value = 'loft';
            titleBox.dispatchEvent(new Event('input'));
            fixture.detectChanges();
            expect(component.title()).toBe('loft');
            expect(pending().length).withContext('requested before Apply').toBe(0);

            el.querySelector<HTMLButtonElement>('.filter-toolbar .apply-btn')!.click();
            fixture.detectChanges();
            const applied = only();
            expect(applied.request.params.get('title')).toBe('loft');
            applied.flush(page('loft'));
        });
    });

    it('restores building type and seller, sends false, and clears both filters', async () => {
        const { fixture, component } = await renderAt('/?buildingType=blok&private=false');
        const restored = only();
        expect(restored.request.params.get('buildingType')).toBe('blok');
        expect(restored.request.params.get('private')).toBe('false');
        restored.flush(page('agency'));
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector<HTMLSelectElement>('[aria-label="Filter by Seller"]')!.value).toBe('false');
        await fixture.whenStable();
        expect(urlParams()['private']).toBe('false');
        component.clearFilters();
        TestBed.tick();
        const cleared = only();
        expect(cleared.request.params.has('private')).toBeFalse();
        expect(cleared.request.params.has('buildingType')).toBeFalse();
        expect(component.seller()).toBe('');
        expect(component.buildingType()).toBe('');
        cleared.flush(page('all'));
    });

    for (const [website, id] of [['OLX', '0'], ['Morizon', '1'], ['Nieruchomości-online', '2']]) {
        it('filters by ' + website + ' and preserves the selected website through sorting and paging', async () => {
            const { fixture, component } = await renderAt('/?webName=' + id);
            const restored = only();
            expect(restored.request.params.get('webName')).toBe(id);
            restored.flush(page('website'));
            fixture.detectChanges();
            const select = (fixture.nativeElement as HTMLElement)
                .querySelector<HTMLSelectElement>('[aria-label="Filter by Website"]')!;
            expect(select.value).toBe(id);
            expect(select.selectedOptions[0].textContent!.trim()).toBe(website);
            expect(component.hasFilters()).toBeTrue();
            await fixture.whenStable();
            expect(urlParams()['webName']).toBe(id);

            component.sortByColumn('price');
            TestBed.tick();
            const sorted = only();
            expect(sorted.request.params.get('webName')).toBe(id);
            sorted.flush(page('sorted'));
            component.onPage({ pageIndex: 1, pageSize: 25, length: 100 });
            TestBed.tick();
            const paged = only();
            expect(paged.request.params.get('webName')).toBe(id);
            paged.flush(page('paged'));

            component.clearFilters();
            TestBed.tick();
            const cleared = only();
            expect(cleared.request.params.has('webName')).toBeFalse();
            expect(component.website()).toBe('');
            expect(component.hasFilters()).toBeFalse();
            cleared.flush(page('all'));
        });
    }

    it('applies a website selected in the filter panel, including OLX with id zero', () => {
        const { fixture } = render();
        only().flush(page('all'));
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const select = el.querySelector<HTMLSelectElement>('[aria-label="Filter by Website"]')!;
        select.value = '0';
        select.dispatchEvent(new Event('change'));
        fixture.detectChanges();
        expect(pending().length).toBe(0);
        el.querySelector<HTMLButtonElement>('.apply-btn')!.click();
        TestBed.tick();
        const applied = only();
        expect(applied.request.params.get('webName')).toBe('0');
        applied.flush(page('olx'));
    });

    it('ignores an unknown website in a shared link', async () => {
        const { component } = await renderAt('/?webName=99');
        const request = only();
        expect(request.request.params.has('webName')).toBeFalse();
        expect(component.website()).toBe('');
        request.flush(page('all'));
    });

    // Reloading the page or sharing its link used to drop every filter, the sort and the page.
    //
    // whenStable() waits for the URL write, a navigation. It waits for open HTTP requests
    // as well, so each spec answers the list's request before it waits.
    describe('address bar', () => {

        it('restores the applied filters, sort and page from the query string', async () => {
            const { fixture, component } = await renderAt('/?title=kawalerka&city=Krakow&market=primary'
                + '&priceMin=300000&priceChangeMax=-10000&snapshotCountMin=2&search=osiedle'
                + '&sortBy=priceChange&sortDir=asc&page=3&pageSize=25');

            // The very first request already asks for it: there is no unfiltered one before.
            const restored = only();
            const sent = (key: string) => restored.request.params.get(key);
            expect(sent('title')).toBe('kawalerka');
            expect(sent('city')).toBe('Krakow');
            expect(sent('market')).toBe('primary');
            expect(sent('priceMin')).toBe('300000');
            expect(sent('priceChangeMax')).toBe('-10000');
            expect(sent('snapshotCountMin')).toBe('2');
            expect(sent('search')).toBe('osiedle');
            expect(sent('sortBy')).toBe('priceChange');
            expect(sent('sortDir')).toBe('asc');
            expect(sent('page')).toBe('3');
            expect(sent('pageSize')).toBe('25');
            restored.flush(page('restored'));
            fixture.detectChanges();

            // The boxes show what is applied, so the next Apply keeps it instead of quietly
            // dropping it; so do the paginator and the sort header.
            const el = fixture.nativeElement as HTMLElement;
            const box = (label: string) =>
                el.querySelector<HTMLInputElement | HTMLSelectElement>(`.filter-grid [aria-label="${label}"]`)?.value;
            expect(box('Filter by Title')).toBe('kawalerka');
            expect(box('Filter by City')).toBe('Krakow');
            expect(box('Filter by Market')).toBe('primary');
            expect(box('Price from')).toBe('300000');
            expect(box('Change to')).toBe('-10000');
            expect(component.search()).toBe('osiedle');
            expect(component.pageIndex()).toBe(2);
            expect(component.pageSize()).toBe(25);
            expect(component.ariaSort('priceChange')).toBe('ascending');

            await fixture.whenStable();
            expect(pending().length).withContext('requests after the page settled').toBe(0);
            expect(urlParams()).withContext('the URL still names the same query').toEqual({
                title: 'kawalerka', city: 'Krakow', market: 'primary', priceMin: '300000',
                priceChangeMax: '-10000', snapshotCountMin: '2', search: 'osiedle',
                sortBy: 'priceChange', sortDir: 'asc', page: '3', pageSize: '25'
            });
        });

        it('drops query-string values the page could not have written, and tidies the URL', async () => {
            const { fixture, component } = await renderAt('/?sortBy=bogus&sortDir=up&page=0&pageSize=7'
                + '&priceMin=abc&areaMax=80&city=Warszawa&market=luxury&utm_source=newsletter');

            const request = only();
            const params = request.request.params;
            expect(params.get('sortBy')).toBe('lastSeen');
            expect(params.get('sortDir')).toBe('desc');
            expect(params.get('page')).toBe('1');
            expect(params.get('pageSize')).toBe('10');
            for (const key of ['priceMin', 'city', 'market', 'utm_source']) {
                expect(params.has(key)).withContext(`${key} sent`).toBeFalse();
            }
            // A valid value among them still counts.
            expect(params.get('areaMax')).toBe('80');
            request.flush(page('defaults'));

            expect(component.priceMin()).toBe('');
            expect(component.city()).toBe('');
            expect(component.market()).toBe('');
            expect(component.areaMax()).toBe('80');

            await fixture.whenStable();
            expect(urlParams()).toEqual({ areaMax: '80' });
            expect(pending().length).withContext('tidying the URL re-requested').toBe(0);
        });

        it('ignores a page that is not a whole number from 1 up', async () => {
            for (const bad of ['-2', '2.5', 'last']) {
                TestBed.resetTestingModule();
                const { fixture } = await renderAt(`/?page=${bad}`);
                const request = only();
                expect(request.request.params.get('page')).withContext(`page=${bad}`).toBe('1');
                request.flush(page('first'));
                await fixture.whenStable();
                http.verify();
            }
        });

        it('writes the applied query, sort and page to the URL, and leaves half-typed filters out', async () => {
            const { fixture, component } = render();
            only().flush(page('initial'));
            await fixture.whenStable();
            expect(urlParams()).withContext('the untouched page').toEqual({});

            component.city.set('Krakow');
            component.priceChangeMax.set('-10000');
            component.applyFilters();
            TestBed.tick();
            only().flush(page('applied'));
            await fixture.whenStable();
            expect(urlParams()).toEqual({ city: 'Krakow', priceChangeMax: '-10000' });

            // Typed but not applied: it stays out of the URL as it stays out of the request,
            // and the page's own write coming back does not wipe it from its box either.
            component.title.set('loft');
            component.sortByColumn('price');
            TestBed.tick();
            only().flush(page('sorted'));
            await fixture.whenStable();
            expect(urlParams()).toEqual({ city: 'Krakow', priceChangeMax: '-10000', sortBy: 'price', sortDir: 'asc' });
            expect(component.title()).toBe('loft');

            component.onPage({ pageIndex: 2, pageSize: 25, length: 100 });
            TestBed.tick();
            only().flush(page('paged'));
            await fixture.whenStable();
            expect(urlParams()).toEqual({
                city: 'Krakow', priceChangeMax: '-10000', sortBy: 'price', sortDir: 'asc', page: '3', pageSize: '25'
            });
            expect(pending().length).withContext('requests caused by the URL writes').toBe(0);

            // Every write replaced the entry: Back leaves the list instead of stepping through
            // each sort and page turn.
            const changes = location().urlChanges;
            expect(changes.length).toBeGreaterThan(0);
            expect(changes.filter(change => !change.startsWith('replace: ')))
                .withContext('history entries pushed').toEqual([]);
        });

        // The toolbar's Properties link, clicked from a filtered list, keeps this component
        // and changes only the query string. The table used to stay filtered under a bare URL.
        it('follows a link that changes only the query string', async () => {
            const { fixture, component } = await renderAt('/?city=Krakow&sortBy=price&sortDir=asc&page=2');
            only().flush(page('filtered'));
            await fixture.whenStable();
            component.title.set('loft');

            await TestBed.inject(Router).navigateByUrl('/');
            TestBed.tick();

            const reset = only();
            expect(reset.request.params.has('city')).toBeFalse();
            expect(reset.request.params.get('sortBy')).toBe('lastSeen');
            expect(reset.request.params.get('page')).toBe('1');
            expect(component.city()).toBe('');
            expect(component.title()).withContext('the boxes follow the link too').toBe('');
            reset.flush(page('all'));

            await fixture.whenStable();
            expect(urlParams()).toEqual({});
            expect(pending().length).toBe(0);
        });
    });

    it('shows a failure as an error, and retry re-sends the same query', () => {
        const { fixture, component } = render();
        const el = fixture.nativeElement as HTMLElement;
        only().flush(page('initial'));

        component.title.set('loft');
        component.applyFilters();
        TestBed.tick();
        only().flush('down', { status: 503, statusText: 'Unavailable' });
        expect(component.properties.error()).toBe('The server failed while loading properties. Try again in a moment.');

        // The error takes the rows' place, not the header's: a failure is the moment the
        // filter that caused it most needs to be reachable.
        fixture.detectChanges();
        expect(el.querySelector('.state-cell.error')?.textContent).toContain('The server failed');
        expect(el.querySelector<HTMLInputElement>('.filter-grid [aria-label="Filter by Title"]')?.value).toBe('loft');
        expect(el.querySelector('mat-paginator')).withContext('paginator without a result').toBeNull();

        el.querySelector<HTMLButtonElement>('.state-cell.error button')!.click();
        TestBed.tick();

        const retried = only();
        expect(retried.request.params.get('sortBy')).toBe('lastSeen');
        expect(retried.request.params.get('title')).toBe('loft');
        retried.flush(page('retried'));
        fixture.detectChanges();
        expect(component.properties.error()).toBeNull();
        expect(el.querySelector('.state-cell.error')).toBeNull();
    });

    // A 0 price is one the portal did not state; the API reports the change against it as
    // unknown (null) rather than as a rise or drop by the whole price.
    it('shows an unknown price change as a dash, like an unchanged one', () => {
        const { fixture } = render();
        const row = (id: string, priceChange: number | null) =>
            ({ id, title: id, url: `https://example.com/${id}`, priceChange } as PropertyListItem);
        only().flush({
            items: [row('dropped', -20_000), row('unknown', null), row('unchanged', 0)],
            totalCount: 3, page: 1, pageSize: 10, totalPages: 1
        });
        fixture.detectChanges();

        const cells = [...(fixture.nativeElement as HTMLElement).querySelectorAll('td[data-label="Change"]')];
        const texts = cells.map(cell => cell.textContent!.replace(/\s+/g, ' ').trim());
        // Any grouping separator: the test runs in whichever locale TestBed defaults to.
        expect(texts[0]).toMatch(/^▼ -20.000 PLN$/);
        expect(texts.slice(1)).toEqual(['—', '—']);
        expect(cells[0].querySelector('.delta.down')).not.toBeNull();
    });

    // When a scrape last found the offer listed: an old date is an offer that is gone.
    it('shows the date of each offer\'s newest snapshot, and marks the default sort on its header', () => {
        const { fixture } = render();
        const row = (id: string, lastSeen: string) =>
            ({ id, title: id, url: `https://example.com/${id}`, lastSeen } as PropertyListItem);
        only().flush({
            // The API sends the time without a zone, to the microsecond.
            items: [row('listed', '2026-09-21T21:01:08.298453'), row('broken', 'not a date')],
            totalCount: 2, page: 1, pageSize: 10, totalPages: 1
        });
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;

        const cells = [...el.querySelectorAll('td[data-label="Latest snapshot"]')].map(cell => cell.textContent!.trim());
        // A value DatePipe cannot read shows a dash, and does not break the table.
        expect(cells).toEqual([formatDate('2026-09-21T21:01:08.298453Z', 'dd.MM.yyyy HH:mm', 'en-US'), '—']);
        expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-21T21:01:08.298453Z');

        // The list opens sorted by it, newest first, and its header shows that.
        const header = [...el.querySelectorAll('thead th')].find(th => th.textContent!.includes('Latest snapshot'));
        expect(header?.getAttribute('aria-sort')).toBe('descending');
        expect(header?.querySelector('.sort-arrow')?.textContent).toBe('▼');
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

    // Scraped Polish on an English page: without lang, a screen reader spells it out in English.
    it('combines the location, omits removed columns, and preserves Polish pronunciation', () => {
        const { fixture } = render();
        const row = (id: string, district: string) => ({
            id, title: `Mieszkanie ${id}`, url: `https://example.com/${id}`, city: 'Krakow',
            district, market: 'Wtórny', priceChange: 0
        } as PropertyListItem);
        only().flush({
            items: [row('a', 'Podgórze'), row('b', '')],
            totalCount: 2, page: 1, pageSize: 10, totalPages: 1
        });
        fixture.detectChanges();

        const [withDistrict, withoutDistrict] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')];
        const polish = (tr: Element) => [...tr.querySelectorAll('[lang="pl"]')].map(node => node.textContent!.trim());
        expect(polish(withDistrict)).toEqual(['Mieszkanie a', 'Krakow, Podgórze']);
        // No trailing separator when the district is missing.
        expect(polish(withoutDistrict)).toEqual(['Mieszkanie b', 'Krakow']);

        // Card view prints each cell's data-label inside the cell, so lang stays off the
        // cell itself wherever there is one - the English "Location" is not Polish.
        expect(withDistrict.querySelector('td[data-label="Market"]')).toBeNull();
        expect(withDistrict.querySelector('td[data-label="Floor"]')).toBeNull();
        expect(withDistrict.children.length).toBe(9);
        const labelled = withDistrict.querySelectorAll('td[data-label][lang]');
        expect(labelled.length).withContext('labelled cells marked as Polish').toBe(0);
    });

    // Review finding 3: prerendering baked "Failed to load properties." into the static HTML.
    it('does not call the API while rendering on the server', () => {
        const { component } = render('server');

        expect(pending().length).toBe(0);
        expect(component.properties.loading()).toBeTrue();
        expect(location().urlChanges).withContext('URL written on the server').toEqual([]);

        component.toggleMap();
        TestBed.tick();
        expect(mapRequests().length).withContext('map requests on the server').toBe(0);
    });

    it('refreshes the list and open map after a scrape while preserving applied filters', async () => {
        const { component } = await renderAt('/?webName=0&priceMax=900000&sortBy=price&page=2');
        only().flush(page('old'));
        component.toggleMap();
        TestBed.tick();
        mapRequests().forEach(request => request.flush(mapOffers(offer('old'))));
        component.title.set('not yet applied');
        TestBed.inject(RealEstateDataService).invalidateAll();
        TestBed.tick();
        const refreshed = only();
        expect(refreshed.request.params.get('webName')).toBe('0');
        expect(refreshed.request.params.get('priceMax')).toBe('900000');
        expect(refreshed.request.params.get('page')).toBe('2');
        expect(refreshed.request.params.get('sortBy')).toBe('price');
        expect(refreshed.request.params.has('title')).toBeFalse();
        refreshed.flush(page('fresh'));
        const maps = mapRequests();
        expect(maps.length).toBe(2);
        maps.forEach(request => request.flush(mapOffers(offer('fresh'))));
        expect(component.title()).toBe('not yet applied');
        expect(mapTitles(component)).toEqual(['fresh', 'fresh']);
    });

    describe('map', () => {

        it('loads nothing until opened, then loads every city while "All" is applied', () => {
            const { component } = render();
            only().flush(page('x'));
            expect(mapRequests().length).withContext('requests before opening').toBe(0);

            component.toggleMap();
            TestBed.tick();

            const requests = mapRequests();
            const cityOf = (request: TestRequest) => request.request.url.split('/').pop();
            expect(requests.map(cityOf)).toEqual(jasmine.arrayWithExactContents(['Silesia', 'Krakow']));
            requests.forEach(request => request.flush(mapOffers(offer(`in ${cityOf(request)}`))));

            expect(mapTitles(component)).toEqual(jasmine.arrayWithExactContents(['in Silesia', 'in Krakow']));
        });

        it('requests only the applied city and plots the offers the applied filters select', () => {
            const { component } = render();
            only().flush(page('initial'));
            component.market.set('primary');
            applyCity(component, 'Krakow');

            component.toggleMap();
            TestBed.tick();
            expect(mapRequests('Silesia').length).withContext('Silesia requests').toBe(0);
            mapRequests('Krakow')[0].flush(mapOffers(
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
            expect(mapRequests().length).withContext('refetched for a filter the client applies').toBe(0);
        });

        it('switches to the newly applied city', () => {
            const { component } = render();
            only().flush(page('initial'));
            applyCity(component, 'Krakow');
            component.toggleMap();
            TestBed.tick();
            mapRequests('Krakow')[0].flush(mapOffers(offer('in Krakow')));

            applyCity(component, 'Silesia');

            expect(component.mapPoints.loading()).toBeTrue();
            mapRequests('Silesia')[0].flush(mapOffers(offer('in Silesia')));
            expect(mapTitles(component)).toEqual(['in Silesia']);
        });

        // A new offer array makes the map frame itself again, throwing away the user's pan and zoom.
        it('hands the map the same offers while the table is sorted, paged or reloaded', () => {
            const { component } = render();
            only().flush(page('initial'));
            component.toggleMap();
            TestBed.tick();
            mapRequests().forEach(request => request.flush(mapOffers(offer(request.request.url))));
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

            expect(mapRequests().length).withContext('map requests').toBe(0);
            expect(component.mapMatches()).toBe(before);
        });

        it('shows a failed load as an error, and retry requests it again', () => {
            const { component } = render();
            only().flush(page('initial'));
            applyCity(component, 'Krakow');
            component.toggleMap();
            TestBed.tick();

            mapRequests('Krakow')[0].flush('down', { status: 503, statusText: 'Unavailable' });
            expect(component.mapPoints.error()).toBe('The server failed while loading the map. Try again in a moment.');
            expect(component.mapMatches()).toBeNull();

            component.retryMap();
            TestBed.tick();
            mapRequests('Krakow')[0].flush(mapOffers(offer('recovered')));

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

            mapRequests().forEach(request => request.flush(mapOffers(
                offer(`${request.request.url} cheap`, { price: 300_000 }),
                offer(`${request.request.url} dear`, { price: 900_000 })
            )));
            fixture.detectChanges();
            expect(summary()).toBe('4 offers from the latest scrape match the applied filters. '
                + 'Older listings and offers without a location are not on the map. '
                + 'The website, change and snapshot filters narrow the table only.');
            expect((await fixture.getDeferBlocks()).length).withContext('map blocks with offers').toBe(1);

            fixture.componentInstance.priceMax.set('1');
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
