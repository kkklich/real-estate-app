import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PropertyHistoryComponent } from './property-history.component';
import { PropertyHistory, PropertyHistoryEntry } from '../../../models/propertyHistory';

describe('PropertyHistoryComponent', () => {

    let http: HttpTestingController;
    let queryParams: BehaviorSubject<Params>;

    function render(params: Params) {
        queryParams = new BehaviorSubject<Params>(params);
        TestBed.configureTestingModule({
            imports: [PropertyHistoryComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ActivatedRoute, useValue: { queryParams } }
            ]
        });
        http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(PropertyHistoryComponent);
        fixture.detectChanges();
        return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
    }

    const forCity = (city: string) => http.expectOne(r => r.url.endsWith(`/api/RealEstate/propertyHistory/${city}`));

    const entry = (date: string, price: number, priceChange: number | null = 0, url = ''): PropertyHistoryEntry =>
        ({ date, price, pricePerMeter: Math.round(price / 48), webName: 1, url, priceChange });

    /** The text of one row of the details list, by its label. */
    const detail = (el: HTMLElement, label: string) =>
        Array.from(el.querySelectorAll('.detail'))
            .find(item => item.querySelector('dt')?.textContent?.trim() === label)
            ?.querySelector('dd');

    const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();

    /** The text of every snapshot row's cell in one column, oldest first. */
    const column = (el: HTMLElement, label: string) =>
        Array.from(el.querySelectorAll(`tbody td[data-label="${label}"]`)).map(text);

    const history = (entries: PropertyHistoryEntry[]): PropertyHistory => ({
        id: '1', url: 'https://example.com/offer', title: 'Two rooms in Podgorze', city: 'Krakow',
        district: 'Podgorze', area: 48, price: 700_000, pricePerMeter: 14_583, floor: 2, market: 'Wtorny',
        buildingType: 'Blok', private: false, webName: 1, lat: 50.04, lon: 19.95, offertId: 'A1',
        description: '', createdTime: '2026-06-01T10:00:00', firstSeen: '2026-06-02T10:00:00',
        lastSeen: '2026-09-10T10:00:00', snapshotCount: entries.length, firstPrice: 750_000,
        totalPriceChange: -50_000, entries
    });

    beforeEach(() => spyOn(console, 'error'));
    afterEach(() => http.verify());

    it('reports missing query parameters without calling the API', () => {
        const { component } = render({});

        expect(component.history.error()).toBe('Missing city or url parameter.');
    });

    it('loads the offer named by the query string and renders it', () => {
        const { fixture, component, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

        const request = forCity('Krakow');
        expect(request.request.params.get('url')).toBe('https://example.com/offer');
        request.flush(history([entry('2026-09-10T10:00:00', 700_000)]));
        fixture.detectChanges();

        expect(component.history.data()?.title).toBe('Two rooms in Podgorze');
        expect(el.querySelector('.offer-title')?.textContent).toContain('Two rooms in Podgorze');
    });

    it('drops snapshots with unparseable dates and plots the rest oldest first', () => {
        const { fixture, component } = render({ city: 'Krakow', url: 'https://example.com/offer' });

        forCity('Krakow').flush(history([
            entry('not a date', 1),
            entry('2026-09-10T10:00:00', 700_000),
            entry('2026-06-02T10:00:00', 750_000)
        ]));
        expect(() => fixture.detectChanges()).not.toThrow();

        const points = component['points']();
        expect(points.map(p => p.price)).toEqual([750_000, 700_000]);
    });

    // Found by the test above: the chart skipped bad dates, but DatePipe in the table and the
    // detail list still threw on them and blanked the whole page.
    it('shows a dash for dates the API sent in a format it cannot parse', () => {
        const { fixture, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

        forCity('Krakow').flush({ ...history([entry('garbage', 1)]), createdTime: 'garbage' });
        expect(() => fixture.detectChanges()).not.toThrow();

        const created = Array.from(el.querySelectorAll('.detail'))
            .find(detail => detail.querySelector('dt')?.textContent?.trim() === 'Created on source');
        expect(created?.querySelector('dd')?.textContent?.trim()).toBe('—');
        expect(el.querySelector('tbody tr td')?.textContent?.trim()).toBe('—');
    });

    describe('prices the portal did not state', () => {

        // The API's own example: a 0 price is unknown, so the step into it and the first
        // step out of it are unknown too, and later steps compare with the last stated price.
        it('shows an unknown step as a dash and plots only the stated prices', () => {
            const { fixture, component, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

            forCity('Krakow').flush({
                ...history([
                    entry('2026-06-01T10:00:00', 0, 0),
                    entry('2026-06-10T10:00:00', 500_000, null),
                    entry('2026-07-01T10:00:00', 0, null),
                    entry('2026-08-01T10:00:00', 480_000, -20_000),
                    entry('2026-09-01T10:00:00', 490_000, 10_000)
                ]),
                price: 490_000, firstPrice: 500_000, totalPriceChange: -10_000
            });
            fixture.detectChanges();

            // Any grouping separator: the test runs in whichever locale TestBed defaults to.
            const prices = column(el, 'Price');
            expect(prices[0]).toBe('—');
            expect(prices[1]).toMatch(/^500.000 PLN$/);
            expect(prices[2]).toBe('—');
            expect(column(el, 'Price / m²')[2]).toBe('—');

            const changes = column(el, 'Change');
            expect(changes.slice(0, 3)).toEqual(['—', '—', '—']);
            expect(changes[3]).toMatch(/^▼ -20.000 PLN$/);
            expect(changes[4]).toMatch(/^▲ 10.000 PLN$/);

            expect(text(detail(el, 'First price'))).toMatch(/^500.000 PLN$/);
            expect(text(detail(el, 'Total change'))).toMatch(/^▼ -10.000 PLN$/);

            // Plotted as 0, an unstated price drew a crash to nothing and back.
            expect(component['points']().map(p => p.price)).toEqual([500_000, 480_000, 490_000]);
            expect(el.textContent).not.toContain('NaN');
        });

        it('shows the current, first and total figures as a dash when no price was stated', () => {
            const { fixture, component, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

            forCity('Krakow').flush({
                ...history([entry('2026-06-01T10:00:00', 0, 0), entry('2026-09-01T10:00:00', 0, null)]),
                price: 0, pricePerMeter: 0, firstPrice: 0, totalPriceChange: null
            });
            fixture.detectChanges();

            for (const label of ['Current price', 'Price / m²', 'First price', 'Total change']) {
                expect(text(detail(el, label))).withContext(label).toBe('—');
            }
            expect(column(el, 'Price')).toEqual(['—', '—']);
            expect(column(el, 'Change')).toEqual(['—', '—']);
            // No figure at all: not "0 PLN", and not a sum worked out from one.
            expect(el.textContent).not.toContain('PLN');
            expect(el.textContent).not.toContain('NaN');

            // The snapshots are listed below, so the chart does not claim there are none.
            expect(component['points']()).toEqual([]);
            expect(text(el.querySelector('.chart-empty'))).toBe('No snapshot states a price to plot');
        });

        it('shows a change the API could not work out as a dash', () => {
            const { fixture, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

            // A newest snapshot without a price leaves the total unknown, even though an
            // older one stated a price.
            forCity('Krakow').flush({
                ...history([entry('2026-06-01T10:00:00', 500_000, 0), entry('2026-09-01T10:00:00', 0, null)]),
                price: 0, pricePerMeter: 0, firstPrice: 500_000, totalPriceChange: null
            });
            fixture.detectChanges();

            expect(text(detail(el, 'Total change'))).toBe('—');
            expect(detail(el, 'Total change')?.querySelector('.delta.flat')).not.toBeNull();
            expect(text(detail(el, 'First price'))).toMatch(/^500.000 PLN$/);
            expect(column(el, 'Change')).toEqual(['—', '—']);
        });
    });

    // The list's Change compares snapshots of one link only; the history also merges the
    // flat's re-posts under other links, so the two totals can differ, and the page says why.
    it('notes when the history takes in links other than the offer\'s own', () => {
        const { fixture, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });
        const note = () => text(el.querySelector('.history-note'));

        // One listing, its link spelled several ways: nothing to explain.
        forCity('Krakow').flush(history([
            entry('2026-06-01T10:00:00', 750_000, 0, 'https://example.com/offer?utm_source=olx'),
            entry('2026-07-01T10:00:00', 720_000, -30_000, 'https://EXAMPLE.com/offer/'),
            entry('2026-08-01T10:00:00', 710_000, -10_000, ''),
            entry('2026-09-10T10:00:00', 700_000, -10_000, 'https://example.com/offer#gallery')
        ]));
        fixture.detectChanges();
        expect(note()).toBeUndefined();

        queryParams.next({ city: 'Krakow', url: 'https://example.com/offer' });
        forCity('Krakow').flush(history([
            entry('2026-06-01T10:00:00', 750_000, 0, 'https://example.com/old-offer'),
            entry('2026-09-10T10:00:00', 700_000, -50_000, 'https://example.com/offer')
        ]));
        fixture.detectChanges();
        expect(note()).toBe('This history also includes re-posts of the flat under 1 other link. '
            + 'The offers list compares prices under one link only, so its Change can differ '
            + 'from the total change here.');
        expect(el.querySelector('.history-note')?.getAttribute('role')).toBe('note');

        queryParams.next({ city: 'Krakow', url: 'https://example.com/offer' });
        forCity('Krakow').flush(history([
            entry('2026-05-01T10:00:00', 760_000, 0, 'https://other-portal.pl/oferta/123'),
            entry('2026-06-01T10:00:00', 750_000, -10_000, 'https://example.com/old-offer?page=2'),
            entry('2026-07-01T10:00:00', 740_000, -10_000, 'https://example.com/old-offer'),
            entry('2026-09-10T10:00:00', 700_000, -40_000, 'https://example.com/offer')
        ]));
        fixture.detectChanges();
        expect(note()).toContain('under 2 other links.');
    });

    // Scraped Polish on an English page: without lang, a screen reader spells it out in English.
    it('marks the scraped Polish text, and only that, for screen readers', () => {
        const { fixture, el } = render({ city: 'Krakow', url: 'https://example.com/offer' });

        forCity('Krakow').flush({
            ...history([entry('2026-09-10T10:00:00', 700_000)]),
            title: 'Dwa pokoje na Podgórzu', district: 'Podgórze', market: 'Wtórny',
            buildingType: 'blok', description: 'Słoneczne mieszkanie z balkonem.'
        });
        fixture.detectChanges();

        const polish = Array.from(el.querySelectorAll('[lang="pl"]')).map(text);
        expect(polish).toEqual([
            'Dwa pokoje na Podgórzu', 'Podgórze', 'Wtórny', 'blok', 'Podgórze', 'Słoneczne mieszkanie z balkonem.'
        ]);
        expect(el.querySelector('h1.offer-title')?.getAttribute('lang')).toBe('pl');
        expect(el.querySelectorAll('dt[lang], .section-title[lang]').length).withContext('English labels').toBe(0);

        // A missing value is a dash, which is not Polish text.
        queryParams.next({ city: 'Krakow', url: 'https://example.com/offer' });
        forCity('Krakow').flush({ ...history([]), district: '', market: '', buildingType: '' });
        fixture.detectChanges();
        expect(text(detail(el, 'District'))).toBe('—');
        expect(detail(el, 'District')?.hasAttribute('lang')).toBeFalse();
        expect(detail(el, 'Market')?.hasAttribute('lang')).toBeFalse();
        expect(el.querySelector('.offer-meta [lang]')).toBeNull();
    });

    it('cancels the previous request when the query string changes', () => {
        render({ city: 'Krakow', url: 'https://example.com/a' });
        const first = forCity('Krakow');

        queryParams.next({ city: 'Katowice', url: 'https://example.com/b' });

        expect(first.cancelled).toBeTrue();
        forCity('Katowice').flush(history([]));
    });

    // Review finding 2a: queryParams never completes, so the subscription outlived the page.
    it('stops listening to the query string once the page is destroyed', () => {
        const { fixture } = render({ city: 'Krakow', url: 'https://example.com/a' });
        forCity('Krakow').flush(history([]));
        expect(queryParams.observed).toBeTrue();

        fixture.destroy();

        expect(queryParams.observed).toBeFalse();
    });
});
