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

    const entry = (date: string, price: number): PropertyHistoryEntry =>
        ({ date, price, pricePerMeter: Math.round(price / 48), webName: 1, url: '', priceChange: 0 });

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
