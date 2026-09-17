import { Component, PLATFORM_ID, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { CHART_COLORS } from '../../charts/chart-theme';
import { PropertyListService } from '../../../services/property-list.service';
import { AsyncResource } from '../../../services/async-resource';
import { httpErrorMessage } from '../../../services/http-error-message';
import { PropertyHistory } from '../../../models/propertyHistory';
import { portalName } from '../../../models/enums/web-name.enum';
import { provideAppCharts } from '../../charts/chart-setup';

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
    protected validDate(value: string | null | undefined): string | null {
        return value && Number.isFinite(Date.parse(value)) ? value : null;
    }

    constructor() {
        // queryParams never completes; without takeUntilDestroyed this subscription
        // outlived every visit to the page.
        this.route.queryParams.pipe(
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
     * instead of throwing out of the whole chart.
     */
    protected readonly points = computed(() =>
        (this.history.data()?.entries ?? [])
            .map(entry => ({
                at: Date.parse(entry.date),
                price: entry.price,
                pricePerMeter: entry.pricePerMeter
            }))
            .filter(point => Number.isFinite(point.at))
            .sort((a, b) => a.at - b.at)
    );

    protected readonly chartData = computed<ChartData>(() => {
        const points = this.points();
        return {
            datasets: [
                {
                    type: 'line' as const,
                    label: 'Price (PLN)',
                    data: points.map(p => ({ x: p.at, y: p.price })),
                    yAxisID: 'y',
                    borderColor: CHART_COLORS.brand,
                    backgroundColor: 'rgba(35, 67, 146, 0.08)',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true
                },
                {
                    type: 'line' as const,
                    label: 'Price / m² (PLN)',
                    data: points.map(p => ({ x: p.at, y: p.pricePerMeter })),
                    yAxisID: 'y1',
                    borderColor: '#e08a1e',
                    backgroundColor: 'rgba(224, 138, 30, 0.06)',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false
                }
            ]
        };
    });

    protected readonly chartOptions: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { color: CHART_COLORS.textMuted, usePointStyle: true } },
            tooltip: {
                callbacks: {
                    title: items => new Date(items[0].parsed.x).toLocaleString('pl-PL'),
                    label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('pl-PL')}`
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
            },
            y1: {
                position: 'right',
                beginAtZero: false,
                grace: '15%',
                grid: { display: false },
                ticks: { color: '#e08a1e', callback: value => Number(value).toLocaleString('pl-PL') },
                title: { display: true, text: 'PLN / m²', color: CHART_COLORS.textMuted }
            }
        }
    };
}
