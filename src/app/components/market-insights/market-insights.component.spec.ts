import { TestBed } from '@angular/core/testing';
import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAppIcons } from '../../app-icons';
import { MarketInsightsComponent } from './market-insights.component';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { AsyncResource } from '../../services/async-resource';
import { cityEnum } from '../../models/enums/city.enum';
import { FullDashboard } from '../../models/fullDashboard';
import { DistrictPrice, MarketInsights } from '../../models/marketInsights';

describe('MarketInsightsComponent', () => {

    let dashboard: AsyncResource<FullDashboard>;

    function render() {
        dashboard = new AsyncResource<FullDashboard>();
        const stats = {
            dashboard,
            insights: computed(() => dashboard.data()?.insights ?? null),
            city: signal(cityEnum.Krakow)
        };
        TestBed.configureTestingModule({
            imports: [MarketInsightsComponent],
            providers: [provideZonelessChangeDetection(), provideAppIcons(), { provide: CalculateStatisticsService, useValue: stats }]
        });
        const fixture = TestBed.createComponent(MarketInsightsComponent);
        fixture.detectChanges();
        return { fixture, el: fixture.nativeElement as HTMLElement };
    }

    function loadDistricts(fixture: { detectChanges(): void }, districts: DistrictPrice[]): void {
        const insights: MarketInsights = {
            totalOffers: 100, medianPrice: 600_000, medianPricePerMeter: 14_000, minPricePerMeter: 5_000,
            maxPricePerMeter: 25_000, medianArea: 45, privateOffersPercent: 5,
            offersBySource: [], districts, bestDeals: []
        };
        dashboard.succeed({ insights } as unknown as FullDashboard);
        fixture.detectChanges();
    }

    const district = (name: string, price: number): DistrictPrice =>
        ({ district: name, medianPricePerMeter: price, count: 10 });

    const listed = (el: HTMLElement, kind: 'cheap' | 'expensive') =>
        Array.from(el.querySelectorAll(`.district-price.${kind}`))
            .map(price => price.previousElementSibling?.textContent?.trim());

    it('sorts districts itself instead of trusting the order the API sends', () => {
        const { fixture, el } = render();

        loadDistricts(fixture, [
            district('D', 9_000), district('A', 5_000), district('C', 8_000), district('F', 11_000),
            district('B', 6_000), district('E', 10_000)
        ]);

        expect(listed(el, 'cheap')).toEqual(['A', 'B', 'C']);
        expect(listed(el, 'expensive')).toEqual(['F', 'E', 'D']);
    });

    // A flat slice(0,3) / slice(-3) listed two of four districts as both cheapest and priciest.
    it('never lists the same district as both cheapest and most expensive', () => {
        const { fixture, el } = render();

        loadDistricts(fixture, [district('A', 5_000), district('B', 6_000), district('C', 8_000), district('D', 9_000)]);

        expect(listed(el, 'cheap')).toEqual(['A', 'B']);
        expect(listed(el, 'expensive')).toEqual(['D', 'C']);
    });

    it('hides both district lists when there is only one district to compare', () => {
        const { fixture, el } = render();

        loadDistricts(fixture, [district('A', 5_000)]);

        expect(el.querySelector('.district-list')).toBeNull();
    });

    // Review finding 1c: this branch was dead - a failure left the spinner up forever.
    it('shows the dashboard failure instead of spinning forever', () => {
        const { fixture, el } = render();

        dashboard.fail('Could not reach the server while loading the dashboard.');
        fixture.detectChanges();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not reach the server');
        expect(el.querySelector('mat-spinner')).toBeNull();
    });
});
