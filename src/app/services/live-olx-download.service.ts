import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, throwError, timeout } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { cityEnum } from '../models/enums/city.enum';
import { MarketplaceListingsResponse } from '../models/marketplace-listings';

const API_KEY_STORAGE = 'SCRAPE_API_KEY';

/** Component-scoped: leaving the dashboard cancels an unfinished download. */
@Injectable()
export class LiveOlxDownloadService {
    private readonly http = inject(HttpClient);
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    readonly downloading = signal(false);
    readonly message = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    download(city: cityEnum): void {
        if (!this.isBrowser || this.downloading()) return;
        this.downloading.set(true);
        this.message.set(null);
        this.error.set(null);
        let key: string | null = null;
        try { key = localStorage.getItem(API_KEY_STORAGE); } catch { /* Storage is optional. */ }

        // Capture the chosen city here: changing the dashboard during the request must
        // not relabel a file that was fetched for another area.
        this.request(city, key, true).pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.downloading.set(false))
        ).subscribe({
            next: response => {
                try {
                    if (!response || !Array.isArray(response.data) || !Array.isArray(response.pages)
                        || response.city !== city || response.source !== 'olx' || response.page !== 1)
                        throw new Error('Unexpected live listings response.');
                    this.saveFile(response, city);
                    const area = city === cityEnum.Krakow ? 'Kraków' : 'Silesia';
                    this.message.set(response.isPartial
                        ? `Downloaded ${response.returnedCount} listings for ${area}. Some cities failed; see errors in the file.`
                        : `Downloaded ${response.returnedCount} listings for ${area} (first page).`);
                } catch {
                    this.error.set('The listings could not be saved. Please try again.');
                }
            },
            error: err => {
                this.error.set(err instanceof HttpErrorResponse && err.status === 401
                    ? 'A valid API key is required to download live listings.'
                    : 'Could not download live OLX listings. Please try again in a moment.');
            }
        });
    }

    private request(city: cityEnum, key: string | null, allowPrompt: boolean): Observable<MarketplaceListingsResponse> {
        const headers = key ? new HttpHeaders({ 'X-Api-Key': key }) : new HttpHeaders();
        return this.http.get<MarketplaceListingsResponse>(`${environment.apiUrl}/api/RealEstate/marketplaceListings`, {
            params: new HttpParams().set('city', city).set('source', 'olx').set('page', 1),
            headers
        }).pipe(
            // Six cities use up to two groups of 30-second requests; allow a cold start too.
            timeout(120_000),
            catchError((err: unknown) => {
                if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !allowPrompt)
                    return throwError(() => err);
                const replacement = window.prompt('Enter the API key to download live OLX listings:')?.trim();
                if (!replacement) return throwError(() => err);
                try { localStorage.setItem(API_KEY_STORAGE, replacement); } catch { /* Storage is optional. */ }
                return this.request(city, replacement, false);
            })
        );
    }

    private saveFile(response: MarketplaceListingsResponse, city: cityEnum): void {
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `olx-${city.toLowerCase()}-page-1-${stamp}.json`;
        link.hidden = true;
        this.document.body.appendChild(link);
        try { link.click(); }
        finally {
            link.remove();
            // Let the browser start the download before releasing the object URL.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }
}
