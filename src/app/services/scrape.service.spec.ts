import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ScrapeService, ScrapeStatusResponse } from './scrape.service';
import { RealEstateDataService } from './real-estate-data.service';
import { environment } from '../../enviroments/environment';

describe('ScrapeService', () => {
    const api = `${environment.apiUrl}/api/RealEstate`;
    const storedDate = '2026-10-25T11:00:00Z';
    let http: HttpTestingController;
    let snackBar: jasmine.SpyObj<MatSnackBar>;
    let data: jasmine.SpyObj<RealEstateDataService>;
    let storage: Map<string, string>;
    let readStorage: jasmine.Spy;
    let writeStorage: jasmine.Spy;

    function create(initial: ScrapeStatusResponse | null = { isRunning: false, lastScrapedAt: storedDate }, platform = 'browser') {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
                { provide: MatSnackBar, useValue: snackBar },
                { provide: RealEstateDataService, useValue: data },
                { provide: PLATFORM_ID, useValue: platform }
            ]
        });
        http = TestBed.inject(HttpTestingController);
        const service = TestBed.inject(ScrapeService);
        if (initial && platform === 'browser') http.expectOne(`${api}/scrapeStatus`).flush(initial);
        return service;
    }

    function start(service: ScrapeService) {
        service.triggerScrape();
        http.expectOne(`${api}/getdataForManyCities`).flush({}, { status: 202, statusText: 'Accepted' });
    }

    beforeEach(() => {
        jasmine.clock().install();
        storage = new Map();
        readStorage = spyOn(Storage.prototype, 'getItem').and.callFake(key => storage.get(key) ?? null);
        writeStorage = spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { storage.set(key, value); });
        snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
        data = jasmine.createSpyObj<RealEstateDataService>('RealEstateDataService', ['invalidateAll']);
    });

    afterEach(() => {
        try { http?.verify(); } finally {
            TestBed.resetTestingModule();
            jasmine.clock().uninstall();
        }
    });

    it('loads only scrape status without starting dashboard requests', () => {
        const service = create();
        TestBed.tick();
        expect(service.isRunning()).toBeFalse();
        expect(service.lastScraped()).toContain('25-10-2026');
        expect(http.match(() => true).length).toBe(0);
    });

    it('sends the saved API key and prevents duplicate triggers', () => {
        storage.set('SCRAPE_API_KEY', 'saved-key');
        const service = create();
        service.triggerScrape();
        service.triggerScrape();
        const request = http.expectOne(`${api}/getdataForManyCities`);
        expect(request.request.headers.get('X-Api-Key')).toBe('saved-key');
        expect(service.isStarting()).toBeTrue();
        request.flush({}, { status: 202, statusText: 'Accepted' });
        expect(service.isRunning()).toBeTrue();
        expect(service.isStarting()).toBeFalse();
    });

    it('monitors an already-running job after a 409', () => {
        const service = create();
        service.triggerScrape();
        http.expectOne(`${api}/getdataForManyCities`).flush({}, { status: 409, statusText: 'Conflict' });
        expect(service.isRunning()).toBeTrue();
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: true });
    });

    it('ignores an idle status response that predates the trigger', () => {
        const service = create(null);
        const oldStatus = http.expectOne(`${api}/scrapeStatus`);
        start(service);
        oldStatus.flush({ isRunning: false });
        expect(service.isRunning()).toBeTrue();
        expect(data.invalidateAll).not.toHaveBeenCalled();
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: true });
    });

    it('never overlaps status requests and retries after a timeout', () => {
        const service = create();
        start(service);
        jasmine.clock().tick(10_000);
        const slow = http.expectOne(`${api}/scrapeStatus`);
        service.checkStatus();
        jasmine.clock().tick(10_000);
        http.expectNone(`${api}/scrapeStatus`);
        jasmine.clock().tick(5_000);
        expect(slow.cancelled).toBeTrue();
        expect(service.isRunning()).toBeTrue();
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: false });
        expect(service.isRunning()).toBeFalse();
    });

    it('refreshes every city once without inventing a snapshot date or claiming success', () => {
        const service = create();
        const previousDate = service.lastScraped();
        start(service);
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: false, lastScrapedAt: storedDate });
        expect(data.invalidateAll).toHaveBeenCalledTimes(1);
        expect(service.lastScraped()).toBe(previousDate);
        expect(storage.get('real_estate_last_scraped')).toBe('2026-10-25T11:00:00.000Z');
        expect(snackBar.open.calls.mostRecent().args[0]).not.toContain('sukces');
        jasmine.clock().tick(30_000);
        http.expectNone(`${api}/scrapeStatus`);
    });

    it('reports a failed source while refreshing successfully saved data', () => {
        const service = create();
        start(service);
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({
            isRunning: false, lastRunSucceeded: false, lastError: 'OLX (Krakow): download incomplete.'
        });
        expect(service.isRunning()).toBeFalse();
        expect(service.error()).toContain('OLX');
        expect(data.invalidateAll).toHaveBeenCalledTimes(1);
        expect(snackBar.open.calls.mostRecent().args[0]).toContain('błędami');
    });

    it('shows the last source failure when reopening the app', () => {
        const service = create({ isRunning: false, lastRunSucceeded: false, lastError: 'OLX' });
        expect(service.error()).toContain('OLX');
        expect(data.invalidateAll).not.toHaveBeenCalled();
    });

    it('treats a timestamp without a zone as UTC, matching database timestamps', () => {
        const service = create();
        const withZone = service.lastScraped();
        service.checkStatus();
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: false, lastScrapedAt: '2026-10-25T11:00:00' });
        expect(service.lastScraped()).toBe(withZone);
        service.checkStatus();
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: false, lastScrapedAt: 'invalid' });
        expect(service.lastScraped()).toBe(withZone);
    });

    it('continues working when browser storage is blocked', () => {
        readStorage.and.throwError('Storage blocked');
        writeStorage.and.throwError('Storage blocked');
        const service = create();
        expect(service.lastScraped()).toContain('25-10-2026');
        start(service);
        jasmine.clock().tick(10_000);
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: false, lastScrapedAt: storedDate });
        expect(data.invalidateAll).toHaveBeenCalledTimes(1);
    });

    it('prompts once for a bad API key, including when storage cannot persist the retry key', () => {
        writeStorage.and.throwError('Storage blocked');
        const prompt = spyOn(window, 'prompt').and.returnValue(' bad-key ');
        const service = create();
        service.triggerScrape();
        http.expectOne(`${api}/getdataForManyCities`).flush(null, { status: 401, statusText: 'Unauthorized' });
        const retry = http.expectOne(`${api}/getdataForManyCities`);
        expect(retry.request.headers.get('X-Api-Key')).toBe('bad-key');
        retry.flush(null, { status: 401, statusText: 'Unauthorized' });
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(service.error()).toContain('prawidłowy klucz');
        expect(service.isStarting()).toBeFalse();
    });

    it('rechecks status after a trigger timeout because the job might have started', () => {
        const service = create();
        service.triggerScrape();
        const trigger = http.expectOne(`${api}/getdataForManyCities`);
        jasmine.clock().tick(15_000);
        expect(trigger.cancelled).toBeTrue();
        expect(service.isStarting()).toBeFalse();
        http.expectOne(`${api}/scrapeStatus`).flush({ isRunning: true });
        expect(service.isRunning()).toBeTrue();
    });

    it('cancels in-flight status and polling on destruction', () => {
        const service = create();
        start(service);
        jasmine.clock().tick(10_000);
        const request = http.expectOne(`${api}/scrapeStatus`);
        TestBed.resetTestingModule();
        expect(request.cancelled).toBeTrue();
        jasmine.clock().tick(30_000);
        http.expectNone(`${api}/scrapeStatus`);
    });

    it('never reads storage or requests data during prerendering', () => {
        const service = create(null, 'server');
        service.checkStatus();
        service.triggerScrape();
        expect(readStorage).not.toHaveBeenCalled();
        expect(http.match(() => true).length).toBe(0);
    });
});
