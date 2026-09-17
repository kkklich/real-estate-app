import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PropertyListService } from '../../../services/property-list.service';
import { RealEstateDataService } from '../../../services/real-estate-data.service';
import { AsyncResource } from '../../../services/async-resource';
import { httpErrorMessage } from '../../../services/http-error-message';
import { PropertyListItem } from '../../../models/propertyListItem';
import { PagedResult } from '../../../models/pagedResult';
import { PropertyQuery } from '../../../models/propertyQuery';
import { MapPoint } from '../../../models/mapPoint';
import { cityEnum } from '../../../models/enums/city.enum';
import { MapViewComponent } from '../../charts/map-view/map-view.component';
import { MapPointFilters, filterMapPoints } from './map-point-filter';

interface SortableColumn {
    key: string;
    label: string;
}

@Component({
    selector: 'app-properties-list',
    standalone: true,
    imports: [
        DecimalPipe,
        FormsModule,
        RouterLink,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatPaginatorModule,
        // Used only inside @defer, so maplibre-gl downloads when the map is first opened.
        MapViewComponent
    ],
    templateUrl: './properties-list.component.html',
    styleUrl: './properties-list.component.scss'
})
export class PropertiesListComponent {

    private readonly propertyListService = inject(PropertyListService);
    private readonly realEstateData = inject(RealEstateDataService);

    // Prerendering this route used to bake the build machine's failed fetch -
    // literally "Failed to load properties." - into the static HTML that ships.
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly cityList = Object.values(cityEnum);

    readonly columns: readonly SortableColumn[] = [
        { key: 'title', label: 'Title' },
        { key: 'city', label: 'City' },
        { key: 'district', label: 'District' },
        { key: 'market', label: 'Market' },
        { key: 'price', label: 'Price' },
        { key: 'pricePerMeter', label: 'Price / m²' },
        { key: 'area', label: 'Area' },
        { key: 'floor', label: 'Floor' }
    ];

    readonly pageSizeOptions = [10, 25, 50];

    // Filters - uncommitted until Apply is pressed.
    readonly city = signal<string>('');
    readonly market = signal<string>('');
    readonly priceMin = signal<number | null>(null);
    readonly priceMax = signal<number | null>(null);
    readonly areaMin = signal<number | null>(null);
    readonly areaMax = signal<number | null>(null);
    readonly search = signal<string>('');

    // Sort
    readonly sortBy = signal<string>('lastSeen');
    readonly sortDir = signal<'asc' | 'desc'>('desc');

    // Paging
    readonly page = signal<number>(1);
    readonly pageSize = signal<number>(10);

    readonly properties = new AsyncResource<PagedResult<PropertyListItem>>();

    // MatPaginator is zero-based; the API is one-based.
    readonly pageIndex = computed(() => this.page() - 1);

    /** The committed query. Writing to it is what triggers a request. */
    private readonly request = signal<PropertyQuery>({});

    /** Whether the map panel is open. Its offers are only fetched once it is. */
    readonly mapOpen = signal(false);

    /** The current offers of every city the applied filters cover, before filtering. */
    readonly mapPoints = new AsyncResource<MapPoint[]>();

    /** Bumped by retryMap(), so a retry re-requests the same cities. */
    private readonly mapReloadNonce = signal(0);

    /** The applied city, or every city while "All" is applied. */
    private readonly mapCities = computed<cityEnum[]>(() => {
        const city = this.request().city;
        return city ? [city as cityEnum] : this.cityList;
    }, { equal: sameItems });

    /**
     * The applied filters, compared field by field: sorting and paging commit a new query
     * object, and handing the map a new set of offers resets the pan and zoom set on it.
     */
    private readonly mapFilters = computed<MapPointFilters>(() => {
        const { market, priceMin, priceMax, areaMin, areaMax, search } = this.request();
        return { market, priceMin, priceMax, areaMin, areaMax, search };
    }, { equal: sameFields });

    /** What the map draws: the current offers that pass the applied filters. */
    readonly mapMatches = computed(() => {
        const points = this.mapPoints.data();
        return points ? filterMapPoints(points, this.mapFilters()) : null;
    });

    constructor() {
        this.request.set(this.buildQuery());

        toObservable(this.request).pipe(
            filter(() => this.isBrowser),
            tap(() => this.properties.start()),
            // switchMap cancels the request still in flight: without it, sorting twice
            // quickly let the slower first response land last and win.
            switchMap(query => this.propertyListService.getProperties(query).pipe(
                map(data => ({ ok: true as const, data })),
                catchError((err: unknown) => of({ ok: false as const, err }))
            )),
            takeUntilDestroyed()
        ).subscribe(result => {
            if (result.ok) {
                this.properties.succeed(result.data);
            } else {
                console.error('properties request failed', result.err);
                this.properties.fail(httpErrorMessage(result.err, 'properties'));
            }
        });

        this.wireMapPoints();
    }

    applyFilters(): void {
        this.page.set(1);
        this.commit();
    }

    sortByColumn(key: string): void {
        if (this.sortBy() === key) {
            this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortBy.set(key);
            this.sortDir.set('asc');
        }
        this.page.set(1);
        this.commitView();
    }

    onPage(event: PageEvent): void {
        this.page.set(event.pageIndex + 1);
        this.pageSize.set(event.pageSize);
        this.commitView();
    }

    /** Re-sends the committed query as-is; a fresh object is what makes the signal emit. */
    retry(): void {
        this.request.update(query => ({ ...query }));
    }

    toggleMap(): void {
        this.mapOpen.update(open => !open);
    }

    /** Requests the map's offers again. A city that failed is no longer cached, so it is refetched. */
    retryMap(): void {
        this.mapReloadNonce.update(n => n + 1);
    }

    /** Value for aria-sort, so a screen reader announces the current sort. */
    ariaSort(key: string): 'ascending' | 'descending' | 'none' {
        if (this.sortBy() !== key) return 'none';
        return this.sortDir() === 'asc' ? 'ascending' : 'descending';
    }

    /** Commits everything, filters included. Only Apply may do this. */
    private commit(): void {
        this.request.set(this.buildQuery());
    }

    /**
     * Commits sort and paging only, keeping the filters from the last Apply. Rebuilding
     * the whole query here used to apply whatever was half-typed into the filter inputs.
     */
    private commitView(): void {
        this.request.update(query => ({
            ...query,
            page: this.page(),
            pageSize: this.pageSize(),
            sortBy: this.sortBy(),
            sortDir: this.sortDir()
        }));
    }

    /**
     * Loads the offers for the map while it is open: one city's while a city is applied,
     * every city's for "All". The map shows only the latest scrape - the dashboard's
     * data - so offers that are no longer listed stay in the table but off the map.
     */
    private wireMapPoints(): void {
        const trigger = computed(() => ({
            open: this.mapOpen(),
            cities: this.mapCities(),
            nonce: this.mapReloadNonce()
        }));

        toObservable(trigger).pipe(
            filter(({ open }) => open && this.isBrowser),
            tap(() => this.mapPoints.start()),
            // switchMap drops a response for cities the filters have already moved away from.
            switchMap(({ cities }) => forkJoin(cities.map(city => this.realEstateData.getMapPoints(city))).pipe(
                map(perCity => ({ ok: true as const, data: perCity.flat() })),
                catchError((err: unknown) => of({ ok: false as const, err }))
            )),
            takeUntilDestroyed()
        ).subscribe(result => {
            if (result.ok) {
                this.mapPoints.succeed(result.data);
            } else {
                console.error('map points request failed', result.err);
                this.mapPoints.fail(httpErrorMessage(result.err, 'the map'));
            }
        });
    }

    private buildQuery(): PropertyQuery {
        return {
            page: this.page(),
            pageSize: this.pageSize(),
            sortBy: this.sortBy(),
            sortDir: this.sortDir(),
            city: this.city() || undefined,
            market: this.market() || undefined,
            priceMin: this.priceMin() ?? undefined,
            priceMax: this.priceMax() ?? undefined,
            areaMin: this.areaMin() ?? undefined,
            areaMax: this.areaMax() ?? undefined,
            search: this.search() || undefined
        };
    }
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
    return a.length === b.length && a.every((item, i) => item === b[i]);
}

function sameFields(a: MapPointFilters, b: MapPointFilters): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MapPointFilters>;
    return [...keys].every(key => a[key] === b[key]);
}
