import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAppIcons } from '../../app-icons';
import { PriceDropsComponent } from './price-drops.component';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { AsyncResource } from '../../services/async-resource';
import { cityEnum } from '../../models/enums/city.enum';
import { PriceDrop } from '../../models/priceDrop';

describe('PriceDropsComponent', () => {

    let priceDrops: AsyncResource<PriceDrop[]>;

    function render() {
        priceDrops = new AsyncResource<PriceDrop[]>();
        TestBed.configureTestingModule({
            imports: [PriceDropsComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAppIcons(),
                { provide: CalculateStatisticsService, useValue: { priceDrops, city: signal(cityEnum.Krakow) } }
            ]
        });
        const fixture = TestBed.createComponent(PriceDropsComponent);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        return { fixture, el, text: () => el.textContent ?? '' };
    }

    const drop = (overrides: Partial<PriceDrop>): PriceDrop => ({
        url: 'https://example.com/1', title: 'Flat', city: 'Krakow', district: 'Podgorze', area: 40,
        webName: 1, currentPrice: 500_000, previousPrice: 550_000, currentPricePerMeter: 12_500,
        previousSeen: '2026-09-01', lastSeen: '2026-09-10', dropAmount: 50_000, dropPercent: 9.1,
        ...overrides
    });

    it('shows a spinner while loading', () => {
        const { el } = render();

        expect(el.querySelector('[role="status"] mat-spinner')).not.toBeNull();
    });

    // Review findings 1b + 1c: the error branch was unreachable, and a failure rendered
    // as the factual claim that there were no price drops.
    it('shows the failure, and never claims there are no price drops', () => {
        const { fixture, el, text } = render();

        priceDrops.fail('The server failed while loading price drops. Try again in a moment.');
        fixture.detectChanges();

        expect(el.querySelector('[role="alert"]')?.textContent).toContain('The server failed while loading price drops');
        expect(text()).not.toContain('No price drops');
    });

    it('says there are no price drops only when the request succeeded with none', () => {
        const { fixture, text } = render();

        priceDrops.succeed([]);
        fixture.detectChanges();

        expect(text()).toContain('No price drops between the two most recent scrapes.');
    });

    it('lists each drop with its portal name', () => {
        const { fixture, el } = render();

        priceDrops.succeed([drop({ webName: 0 }), drop({ url: 'https://example.com/2', webName: 1 })]);
        fixture.detectChanges();

        const rows = el.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
        expect(rows[0].lastElementChild?.textContent?.trim()).toBe('OLX');
        expect(rows[1].lastElementChild?.textContent?.trim()).toBe('Morizon');
    });
});
