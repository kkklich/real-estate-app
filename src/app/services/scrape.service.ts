import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { RealEstateDataService } from './real-estate-data.service';
import { validSnapshotDate } from './snapshot-date';

export interface ScrapeStatusResponse {
    isRunning: boolean;
    lastScrapedAt?: string | null;
}

const STORAGE_LAST_SCRAPED = 'real_estate_last_scraped';
const STORAGE_API_KEY = 'SCRAPE_API_KEY';
const POLL_INTERVAL = 10_000;
const REQUEST_TIMEOUT = 15_000;

@Injectable({ providedIn: 'root' })
export class ScrapeService {
    private readonly http = inject(HttpClient);
    private readonly dataService = inject(RealEstateDataService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly apiUrl = environment.apiUrl + '/api/RealEstate';

    readonly isRunning = signal(false);
    readonly isStarting = signal(false);
    readonly lastScraped = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private statusPending = false;
    private statusGeneration = 0;
    private wasRunning = false;
    private destroyed = false;
    private apiKey: string | null = null;

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
            this.stopPolling();
        });
        if (this.isBrowser) {
            this.apiKey = this.readStorage(STORAGE_API_KEY);
            this.updateLastScraped(this.readStorage(STORAGE_LAST_SCRAPED));
            this.checkStatus();
        }
    }

    /** One bounded request at a time, including manual checks while a poll is pending. */
    checkStatus(): void {
        if (!this.isBrowser || this.destroyed || this.statusPending || this.isStarting()) return;
        this.stopPolling();
        this.statusPending = true;
        const generation = this.statusGeneration;
        this.http.get<ScrapeStatusResponse>(`${this.apiUrl}/scrapeStatus`).pipe(
            timeout(REQUEST_TIMEOUT),
            takeUntilDestroyed(this.destroyRef),
            finalize(() => {
                this.statusPending = false;
                if (!this.destroyed && this.isRunning()) this.startPolling();
            })
        ).subscribe({
            next: response => {
                // A status request started before the trigger cannot undo the new run.
                if (generation !== this.statusGeneration || this.isStarting()
                    || !response || typeof response.isRunning !== 'boolean') return;
                this.updateLastScraped(response.lastScrapedAt);
                this.isRunning.set(response.isRunning);
                if (!response.isRunning && this.wasRunning) this.onScrapeCompleted();
                this.wasRunning = response.isRunning;
            },
            error: () => {
                // A temporary failure is not evidence that a running job has finished.
            }
        });
    }

    triggerScrape(allowKeyPrompt = true): void {
        if (!this.isBrowser || this.destroyed || this.isRunning() || this.isStarting()) return;
        this.isStarting.set(true);
        this.error.set(null);
        this.statusGeneration++;
        this.stopPolling();
        let headers = new HttpHeaders();
        if (this.apiKey) headers = headers.set('X-Api-Key', this.apiKey);

        this.http.get(`${this.apiUrl}/getdataForManyCities`, { headers, observe: 'response' }).pipe(
            timeout(REQUEST_TIMEOUT),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: response => {
                this.isStarting.set(false);
                if (response.status === 202 || response.status === 200) {
                    this.markRunning('Rozpoczęto pobieranie danych nieruchomości w tle.');
                } else {
                    this.showError('Serwer nie potwierdził uruchomienia pobierania. Sprawdź stan i spróbuj ponownie.');
                    this.checkStatus();
                }
            },
            error: err => {
                this.isStarting.set(false);
                if (err.status === 409) {
                    this.markRunning('Pobieranie danych jest już w toku.');
                } else if (err.status === 401) {
                    this.handleUnauthorized(allowKeyPrompt);
                } else {
                    this.showError('Nie udało się potwierdzić uruchomienia pobierania. Sprawdź połączenie i spróbuj ponownie.');
                    this.checkStatus();
                }
            }
        });
    }

    private markRunning(message: string): void {
        this.isRunning.set(true);
        this.wasRunning = true;
        this.snackBar.open(message, 'OK', { duration: 5000 });
        this.startPolling();
    }

    private handleUnauthorized(allowPrompt: boolean): void {
        // At most one prompt/retry per click: an invalid key must not create a prompt loop.
        const key = allowPrompt
            ? window.prompt('Wymagany jest klucz autoryzacji do pobierania danych. Wprowadź klucz API:')?.trim()
            : null;
        if (key) {
            this.apiKey = key;
            this.writeStorage(STORAGE_API_KEY, key);
            this.triggerScrape(false);
        } else {
            this.showError('Brak autoryzacji: Wymagany prawidłowy klucz API.');
        }
    }

    private startPolling(): void {
        if (this.pollTimer !== null || this.destroyed) return;
        this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this.checkStatus();
        }, POLL_INTERVAL);
    }

    private stopPolling(): void {
        if (this.pollTimer !== null) clearTimeout(this.pollTimer);
        this.pollTimer = null;
    }

    private onScrapeCompleted(): void {
        this.wasRunning = false;
        this.stopPolling();
        this.dataService.invalidateAll();
        // Idle alone proves neither success nor a new snapshot. Keep the server's date.
        this.snackBar.open('Pobieranie nie jest już w toku. Odświeżono dostępne dane.', 'OK', { duration: 6000 });
    }

    private updateLastScraped(value: string | null | undefined): void {
        const iso = validSnapshotDate(value);
        if (!iso) return;
        const date = new Date(iso);
        if (!Number.isFinite(date.getTime())) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        this.lastScraped.set(`${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`);
        this.writeStorage(STORAGE_LAST_SCRAPED, date.toISOString());
    }

    private showError(message: string): void {
        this.error.set(message);
        this.snackBar.open(message, 'Zamknij', { duration: 6000 });
    }

    private readStorage(key: string): string | null {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    private writeStorage(key: string, value: string): void {
        try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
    }
}
