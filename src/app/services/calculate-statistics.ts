import { Injectable, PLATFORM_ID, Signal, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { RealEstateDataService } from './real-estate-data.service';
import { AsyncResource } from './async-resource';
import { httpErrorMessage } from './http-error-message';
import { cityEnum } from '../models/enums/city.enum';
import { FullDashboard } from '../models/fullDashboard';
import { MapPoint } from '../models/mapPoint';
import { PriceDrop } from '../models/priceDrop';

/** Either branch of a request, flattened so switchMap can keep the outer stream alive. */
type Result<T> = { ok: true; data: T } | { ok: false; err: unknown };

@Injectable({ providedIn: 'root' })
export class CalculateStatisticsService {

    private readonly realEstateService = inject(RealEstateDataService);

    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Charts and insights arrive together in one getFullDashboard call. */
    readonly dashboard = new AsyncResource<FullDashboard>();
    /** A lighter, separate call: it loads independently and never blocks the dashboard. */
    readonly priceDrops = new AsyncResource<PriceDrop[]>();
    /**
     * The offers the map plots - by far the biggest response the API serves, and one no
     * page needs until a map is opened, so it is only requested once requestMapPoints() is.
     */
    readonly mapPoints = new AsyncResource<MapPoint[]>();

    readonly charts = computed(() => this.dashboard.data()?.charts ?? null);
    readonly insights = computed(() => this.dashboard.data()?.insights ?? null);

    readonly groupedBy = signal<string>('market');
    readonly city = signal<cityEnum>(cityEnum.Krakow);

    readonly groupByTypes: readonly string[] = [
        'price',
        'pricePerMeter',
        'floor',
        'market',
        'buildingType',
        'area',
        'private',
        'location.district'
    ];

    /** Bumped by reload() so a retry re-runs both requests for the current city. */
    private readonly reloadNonce = signal(0);

    /** Whether a map has been opened; until then its offers are never downloaded. */
    private readonly mapWanted = signal(false);
    /** Bumped by reloadMapPoints(), so the map can retry without refetching the page. */
    private readonly mapNonce = signal(0);

    constructor() {
        // A fresh object every time, so a reload re-emits even when the city has not changed.
        const request = computed(() => ({ city: this.city(), nonce: this.reloadNonce() }));

        this.wire(
            request,
            this.dashboard,
            city => this.realEstateService.getFullDashboard(city),
            'the dashboard'
        );

        this.wire(
            request,
            this.priceDrops,
            city => this.realEstateService.getPriceDrops(city),
            'price drops'
        );

        // Waits for the map to be opened, then follows the city like the others: switching
        // city with the map open replaces its offers, switching it beforehand costs nothing.
        const mapRequest = computed(() => ({
            city: this.city(),
            nonce: this.reloadNonce(),
            mapNonce: this.mapNonce(),
            wanted: this.mapWanted()
        }));

        this.wire(
            mapRequest,
            this.mapPoints,
            city => this.realEstateService.getMapPoints(city),
            'the map',
            request => request.wanted
        );
    }

    /** Called when a map is opened: from here on its offers follow the selected city. */
    requestMapPoints(): void {
        this.mapWanted.set(true);
    }

    /** Requests the map's offers again after a failure. */
    reloadMapPoints(): void {
        this.mapNonce.update(n => n + 1);
    }

    /** Drops the cached responses for the current city and requests them again. */
    reload(): void {
        this.realEstateService.invalidate(this.city());
        this.reloadNonce.update(n => n + 1);
    }

    /**
     * switchMap cancels a request still in flight when the city changes again, so a
     * slow response for a city the user has already left cannot overwrite the new one.
     */
    private wire<T, R extends { city: cityEnum }>(
        request: Signal<R>,
        resource: AsyncResource<T>,
        fetch: (city: cityEnum) => Observable<T>,
        subject: string,
        when: (request: R) => boolean = () => true
    ): void {
        toObservable(request).pipe(
            // Prerendering must not call the API: the build machine has no guaranteed
            // route to it, and whatever came back - a timeout included - would be frozen
            // into the static HTML every visitor is served. Filtering ahead of start()
            // leaves the resource in its initial loading state, so the prerendered page
            // is the spinner the browser is about to replace with real data.
            filter(request => this.isBrowser && when(request)),
            tap(() => resource.start()),
            switchMap(({ city }) => fetch(city).pipe(
                map((data): Result<T> => ({ ok: true, data })),
                catchError((err: unknown) => of<Result<T>>({ ok: false, err }))
            )),
            takeUntilDestroyed()
        ).subscribe(result => {
            if (result.ok) {
                resource.succeed(result.data);
            } else {
                console.error(`${subject} request failed`, result.err);
                resource.fail(httpErrorMessage(result.err, subject));
            }
        });
    }
}
