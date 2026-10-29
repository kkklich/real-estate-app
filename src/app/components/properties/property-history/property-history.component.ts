import { Component, PLATFORM_ID, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { CHART_COLORS } from '../../charts/chart-theme';
import { PropertyListService } from '../../../services/property-list.service';
import { validSnapshotDate } from '../../../services/snapshot-date';
import { RealEstateDataService } from '../../../services/real-estate-data.service';
import { AsyncResource } from '../../../services/async-resource';
import { httpErrorMessage } from '../../../services/http-error-message';
import { PropertyHistory } from '../../../models/propertyHistory';
import { portalName } from '../../../models/enums/web-name.enum';
import { provideAppCharts } from '../../charts/chart-setup';
import { normalizeOfferUrl } from './offer-url';
import { offerActivity, offerKey } from './offer-activity';

@Component({
    selector: 'app-property-history',
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        BaseChartDirective
    ],
    // Registers Chart.js for the price-history chart; see chart-setup.ts.
    providers: [provideAppCharts()],
    templateUrl: './property-history.component.html',
    styleUrl: './property-history.component.scss'
})
export class PropertyHistoryComponent {

    private readonly route = inject(ActivatedRoute);
    private readonly propertyListService = inject(PropertyListService);
    private readonly realEstateData = inject(RealEstateDataService);

    // Prerendering has no query params, so it used to bake "Missing city or url
    // parameter." into the static HTML for this route.
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly history = new AsyncResource<PropertyHistory>();

    protected readonly portalName = portalName;

    protected ownerLabel(isPrivate: boolean): string {
        return isPrivate ? 'Private owner' : 'Agency / developer';
    }

    /**
     * Passes a date through only if it parses, so the template can fall back to a dash.
     * DatePipe throws on anything it cannot convert, and one bad value from the API took
     * the whole page down with it - the chart already skipped such snapshots, the table did not.
     */
    protected validSourceDate(value: string | null | undefined): string | null {
        return value && Number.isFinite(Date.parse(value)) ? value : null;
    }

    protected validDate(value: string | null | undefined): string | null {
        return validSnapshotDate(value);
    }

    /**
     * Passes a price through only if the portal stated one, so the template can fall back
     * to a dash. An offer without a price is stored as 0, and "0 PLN" read as a flat given
     * away rather than one whose price nobody knows.
     */
    protected statedPrice(value: number | null | undefined): number | null {
        return value != null && value > 0 ? value : null;
    }

    /**
     * How many links besides the offer's own the history takes in: the flat re-posted
     * under a new link, or listed on another portal (PropertyComparer in the API). The
     * list's Change compares snapshots of one link only, so with any of these the two
     * totals can differ - both correctly - and the page says so.
     */
    protected readonly otherLinks = computed(() => {
        const history = this.history.data();
        if (!history) return 0;

        const own = normalizeOfferUrl(history.url);
        const others = new Set(history.entries
            .map(entry => normalizeOfferUrl(entry.url))
            .filter(url => url !== '' && url !== own));
        return others.size;
    });

    protected readonly activity = computed(() => {
        const history = this.history.data();
        return history ? offerActivity(history) : { events: [], related: [] };
    });

    constructor() {
        // queryParams never completes; without takeUntilDestroyed this subscription
        // outlived every visit to the page.
        const revision = toObservable(this.realEstateData.revision).pipe(
            startWith(this.realEstateData.revision()), distinctUntilChanged()
        );
        combineLatest([this.route.queryParams, revision]).pipe(
            map(([params]) => params),
            filter(() => this.isBrowser),
            map(params => ({
                city: params['city'] as string | undefined,
                url: params['url'] as string | undefined
            })),
            tap(() => this.history.start()),
            switchMap(({ city, url }) => {
                if (!city || !url) {
                    return of({ ok: false as const, message: 'Missing city or url parameter.' });
                }
                return this.propertyListService.getHistory(city, url).pipe(
                    map(data => ({ ok: true as const, data })),
                    catchError((err: unknown) => {
                        console.error('property history request failed', err);
                        return of({ ok: false as const, message: httpErrorMessage(err, 'this offer history') });
                    })
                );
            }),
            takeUntilDestroyed()
        ).subscribe(result => {
            if (result.ok) {
                this.history.succeed(result.data);
            } else {
                this.history.fail(result.message);
            }
        });
    }

    /**
     * Snapshots are irregularly spaced - minutes apart within one scrape, weeks
     * between scrapes - so the x axis carries timestamps rather than category
     * labels. A category axis draws every gap the same width, which flattens a
     * month of silence into a single step. Unparseable dates are dropped here
     * instead of throwing out of the whole chart, and so are snapshots that did not
     * state a price: plotted as 0 they drew a crash to nothing and back, and pulled the
     * axis down so far that every real move flattened out.
     */
    protected readonly points = computed(() =>
        (this.history.data()?.entries ?? [])
            .map(entry => ({
                at: Date.parse(validSnapshotDate(entry.date) ?? ''),
                price: entry.price,
                pricePerMeter: entry.pricePerMeter,
                key: offerKey(entry.url, entry.webName),
                webName: entry.webName
            }))
            .filter(point => Number.isFinite(point.at) && this.statedPrice(point.price) !== null)
            .sort((a, b) => a.at - b.at)
    );

    /** Keep source offers separate so cross-portal prices never draw a fake change. */
    protected readonly chartData = computed<ChartData>(() => {
        const groups = new Map<string, ReturnType<typeof this.points>>();
        for (const point of this.points()) {
            // Unknown links are isolated: there is no evidence they belong to one series.
            const key = point.key || 'unknown:' + groups.size;
            const group = groups.get(key) ?? [];
            group.push(point);
            groups.set(key, group);
        }
        return {
            datasets: Array.from(groups.values()).map((points, index) => ({
                type: 'line' as const,
                label: portalName(points[0].webName) + ' · ogłoszenie ' + (index + 1),
                data: points.map(p => ({ x: p.at, y: p.price, perMeter: p.pricePerMeter })),
                borderColor: [CHART_COLORS.brand, '#12776d', '#9c4b87', '#a16b19'][index % 4],
                pointRadius: 3,
                pointHoverRadius: 5,
                stepped: true,
                fill: false
            }))
        };
    });

    protected readonly chartOptions: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: {
                callbacks: {
                    title: items => new Date(items[0].parsed.x).toLocaleString('pl-PL'),
                    label: ctx => ` Cena: ${ctx.parsed.y?.toLocaleString('pl-PL')} PLN`,
                    afterLabel: ctx => {
                        const perMeter = (ctx.raw as { perMeter?: number }).perMeter;
                        return perMeter == null ? '' : ` Cena za m²: ${perMeter.toLocaleString('pl-PL')} PLN`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                grid: { display: false },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    maxTicksLimit: 12,
                    // Level labels, thinned to fit: slanted dates were hard to read on a phone.
                    maxRotation: 0,
                    autoSkipPadding: 12,
                    callback: value => new Date(Number(value)).toLocaleDateString('pl-PL')
                }
            },
            y: {
                position: 'left',
                beginAtZero: false,
                grace: '15%',
                grid: { color: CHART_COLORS.grid },
                ticks: { color: CHART_COLORS.brand, callback: value => Number(value).toLocaleString('pl-PL') },
                title: { display: true, text: 'PLN', color: CHART_COLORS.textMuted }
            }
        }
    };
}
