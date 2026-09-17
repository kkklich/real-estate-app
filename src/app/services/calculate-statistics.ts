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
import { PriceDrop } from '../models/priceDrop';

/** Either branch of a request, flattened so switchMap can keep the outer stream alive. */
type Result<T> = { ok: true; data: T } | { ok: false; err: unknown };

@Injectable({ providedIn: 'root' })
export class CalculateStatisticsService {

    private readonly realEstateService = inject(RealEstateDataService);

    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    /** Charts, insights and map points all arrive together in one getFullDashboard call. */
    readonly dashboard = new AsyncResource<FullDashboard>();
    /** A lighter, separate call: it loads independently and never blocks the dashboard. */
    readonly priceDrops = new AsyncResource<PriceDrop[]>();

    readonly charts = computed(() => this.dashboard.data()?.charts ?? null);
    readonly insights = computed(() => this.dashboard.data()?.insights ?? null);
    readonly mapPoints = computed(() => this.dashboard.data()?.mapPoints ?? null);

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
    private wire<T>(
        request: Signal<{ city: cityEnum }>,
        resource: AsyncResource<T>,
        fetch: (city: cityEnum) => Observable<T>,
        subject: string
    ): void {
        toObservable(request).pipe(
            // Prerendering must not call the API: the build machine has no guaranteed
            // route to it, and whatever came back - a timeout included - would be frozen
            // into the static HTML every visitor is served. Filtering ahead of start()
            // leaves the resource in its initial loading state, so the prerendered page
            // is the spinner the browser is about to replace with real data.
            filter(() => this.isBrowser),
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
