import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAppIcons } from '../../app-icons';
import { ScrapeButtonComponent } from './scrape-button.component';
import { ScrapeService } from '../../services/scrape.service';
import { CalculateStatisticsService } from '../../services/calculate-statistics';

describe('ScrapeButtonComponent', () => {
    let isRunningSignal = signal(false);
    let isStartingSignal = signal(false);
    let lastScrapedSignal = signal<string | null>('25-10-2026 12:00');
    let triggerScrapeSpy: jasmine.Spy;

    beforeEach(() => {
        isRunningSignal = signal(false);
        isStartingSignal = signal(false);
        lastScrapedSignal = signal<string | null>('25-10-2026 12:00');
        triggerScrapeSpy = jasmine.createSpy('triggerScrape');

        const mockScrapeService = {
            isRunning: isRunningSignal,
            isStarting: isStartingSignal,
            lastScraped: lastScrapedSignal,
            triggerScrape: triggerScrapeSpy
        };

        const mockStatsService = {
            charts: signal(null)
        };

        TestBed.configureTestingModule({
            imports: [ScrapeButtonComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAppIcons(),
                { provide: ScrapeService, useValue: mockScrapeService },
                { provide: CalculateStatisticsService, useValue: mockStatsService }
            ]
        });
    });

    it('renders last scraped date and fetch button', () => {
        const fixture = TestBed.createComponent(ScrapeButtonComponent);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.textContent).toContain('25-10-2026 12:00');
        expect(el.textContent).toContain('Pobierz dane');

        const btn = el.querySelector('button.scrape-btn') as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.disabled).toBe(false);

        btn.click();
        expect(triggerScrapeSpy).toHaveBeenCalled();
    });

    it('shows loading state and disables button when scrape is in progress', () => {
        isRunningSignal.set(true);

        const fixture = TestBed.createComponent(ScrapeButtonComponent);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.textContent).toContain('Pobieranie w toku...');
        const btn = el.querySelector('button.scrape-btn') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
    });
});
