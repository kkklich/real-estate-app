import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../enviroments/environment';
import { cityEnum } from '../models/enums/city.enum';
import { MarketplaceListingsResponse } from '../models/marketplace-listings';
import { LiveOlxDownloadService } from './live-olx-download.service';

describe('LiveOlxDownloadService', () => {
    const endpoint = `${environment.apiUrl}/api/RealEstate/marketplaceListings`;
    let http: HttpTestingController;
    let storage: Map<string, string>;
    let savedBlob: Blob | null;
    let filename: string | null;

    function create(platform = 'browser') {
        TestBed.configureTestingModule({ providers: [
            provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
            LiveOlxDownloadService, { provide: PLATFORM_ID, useValue: platform }
        ] });
        http = TestBed.inject(HttpTestingController);
        return TestBed.inject(LiveOlxDownloadService);
    }

    function response(city = cityEnum.Krakow): MarketplaceListingsResponse {
        return {
            city, source: 'olx', savedToDatabase: false, fetchedAt: '2026-11-05T18:00:00Z',
            page: 1, pageSize: 36, isPartial: false, returnedCount: 0, hasMore: true,
            nextPage: 2, paginationLimitReached: false, pages: [], data: []
        };
    }

    function pending() { return http.expectOne(req => req.url === endpoint); }

    beforeEach(() => {
        jasmine.clock().install();
        storage = new Map();
        savedBlob = null;
        filename = null;
        spyOn(Storage.prototype, 'getItem').and.callFake(key => storage.get(key) ?? null);
        spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { storage.set(key, value); });
        spyOn(URL, 'createObjectURL').and.callFake(blob => {
            savedBlob = blob as Blob;
            return 'blob:live-olx-test';
        });
        spyOn(URL, 'revokeObjectURL');
        spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function(this: HTMLAnchorElement) {
            filename = this.download;
        });
    });

    afterEach(() => {
        try { http?.verify(); } finally {
            TestBed.resetTestingModule();
            jasmine.clock().tick(1000);
            jasmine.clock().uninstall();
        }
    });

    it('downloads one OLX page for the selected area and preserves the response in a JSON file', async () => {
        storage.set('SCRAPE_API_KEY', 'saved-key');
        const service = create();
        service.download(cityEnum.Silesia);
        service.download(cityEnum.Krakow); // A second click cannot change the pending file's area.
        const request = pending();
        expect(service.downloading()).toBeTrue();
        expect(request.request.params.get('city')).toBe('Silesia');
        expect(request.request.params.get('source')).toBe('olx');
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.headers.get('X-Api-Key')).toBe('saved-key');
        const payload = response(cityEnum.Silesia);
        request.flush(payload);
        expect(service.downloading()).toBeFalse();
        expect(filename).toMatch(/^olx-silesia-page-1-.*\.json$/);
        expect(JSON.parse(await savedBlob!.text())).toEqual(payload);
        expect(service.message()).toContain('Silesia');
        expect(service.message()).toContain('first page');
        expect(document.querySelector('a[download^="olx-"]')).toBeNull();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        jasmine.clock().tick(1000);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:live-olx-test');
        http.expectNone(req => req.url === endpoint); // No automatic full-market pagination.
    });

    it('keeps partial results and tells the user that some cities failed', () => {
        const service = create();
        service.download(cityEnum.Silesia);
        const payload = { ...response(cityEnum.Silesia), isPartial: true, returnedCount: 12 };
        pending().flush(payload);
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(service.message()).toContain('12 listings');
        expect(service.message()).toContain('Some cities failed');
        expect(service.error()).toBeNull();
    });

    it('prompts once after 401 and retries with the supplied API key', () => {
        spyOn(window, 'prompt').and.returnValue(' replacement-key ');
        const service = create();
        service.download(cityEnum.Krakow);
        pending().flush({}, { status: 401, statusText: 'Unauthorized' });
        const retry = pending();
        expect(service.downloading()).toBeTrue();
        expect(retry.request.headers.get('X-Api-Key')).toBe('replacement-key');
        expect(storage.get('SCRAPE_API_KEY')).toBe('replacement-key');
        retry.flush({}, { status: 401, statusText: 'Unauthorized' });
        expect(window.prompt).toHaveBeenCalledTimes(1);
        expect(service.error()).toContain('valid API key');
        expect(service.downloading()).toBeFalse();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('does not retry or download if the key prompt is cancelled', () => {
        spyOn(window, 'prompt').and.returnValue(null);
        const service = create();
        service.download(cityEnum.Krakow);
        pending().flush({}, { status: 401, statusText: 'Unauthorized' });
        expect(service.error()).toContain('valid API key');
        expect(service.downloading()).toBeFalse();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('allows retry after a failed portal request without downloading the error response', () => {
        const service = create();
        service.download(cityEnum.Krakow);
        pending().flush({ pages: [], data: [] }, { status: 502, statusText: 'Bad Gateway' });
        expect(service.error()).toContain('Could not download');
        expect(service.downloading()).toBeFalse();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        service.download(cityEnum.Silesia);
        expect(service.error()).toBeNull();
        pending().flush(response(cityEnum.Silesia));
        expect(filename).toContain('silesia');
    });

    it('rejects a successful response for the wrong area', () => {
        const service = create();
        service.download(cityEnum.Krakow);
        pending().flush(response(cityEnum.Silesia));
        expect(service.error()).toContain('could not be saved');
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('cancels an unfinished request when its dashboard is destroyed', () => {
        const service = create();
        service.download(cityEnum.Krakow);
        const request = pending();
        TestBed.resetTestingModule();
        expect(request.cancelled).toBeTrue();
        expect(service.downloading()).toBeFalse();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('never fetches or creates a file during server rendering', () => {
        const service = create('server');
        service.download(cityEnum.Krakow);
        expect(service.downloading()).toBeFalse();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        http.expectNone(() => true);
    });
});
