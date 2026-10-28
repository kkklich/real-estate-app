import { Component, PLATFORM_ID, WritableSignal, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
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
import { validSnapshotDate } from '../../../services/snapshot-date';
import { RealEstateDataService } from '../../../services/real-estate-data.service';
import { AsyncResource } from '../../../services/async-resource';
import { httpErrorMessage } from '../../../services/http-error-message';
import { PropertyListItem } from '../../../models/propertyListItem';
import { PagedResult } from '../../../models/pagedResult';
import { PropertyQuery } from '../../../models/propertyQuery';
import { MapPoint } from '../../../models/mapPoint';
import { cityEnum } from '../../../models/enums/city.enum';
import { WebName, portalName } from '../../../models/enums/web-name.enum';
import { MapViewComponent } from '../../charts/map-view/map-view.component';
import { MapPointFilters, filterMapPoints } from './map-point-filter';

interface ColumnBase {
    /** The API's sort key for the column, and the column's identity in the template. */
    key: string;
    label: string;
    /** Right-aligns the cells of a column whose values are numbers. */
    numeric?: boolean;
}

/** A free-text column: the API matches the typed value as a substring. */
interface TextColumn extends ColumnBase {
    filter: 'text';
    value: WritableSignal<string>;
    placeholder: string;
}

/** A column with a handful of known values, filtered by picking one of them. */
interface SelectColumn extends ColumnBase {
    filter: 'select';
    value: WritableSignal<string>;
    options: readonly { value: string; label: string }[];
}

/** A numeric column, filtered by an inclusive lower and/or upper bound. */
interface RangeColumn extends ColumnBase {
    filter: 'range';
    min: WritableSignal<string>;
    max: WritableSignal<string>;
}

/** A column that is shown and sorted by, but has no filter box. */
interface PlainColumn extends ColumnBase {
    filter: 'none';
}

type TableColumn = TextColumn | SelectColumn | RangeColumn | PlainColumn;

/**
 * A bound as the query wants it, or undefined for "no bound".
 *
 * The bounds are held as the raw text of their box, not as numbers, and the boxes are
 * <input type="text"> rather than type="number". A number input reports an empty value
 * while its content is not yet a valid number, so the moment someone replaced "10000"
 * with a leading "-" - which the Change column is filtered by all the time - the bound
 * read back as empty and the binding wrote that emptiness over what they had typed.
 */
function bound(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * One filter box as the page's query string carries it. The names are the API's own, so
 * a shared link reads like the request it makes.
 */
interface FilterField {
    name: string;
    box: WritableSignal<string>;
    /** Whether a query-string value is one the page itself could have written here. */
    accepts: (raw: string) => boolean;
}

// What an empty query string means, and so what is left out of one: the plain
// /properties link and the page nobody has touched yet must be the same URL.
const DEFAULT_SORT_BY = 'lastSeen';
const DEFAULT_SORT_DIR = 'desc';
const DEFAULT_PAGE_SIZE = 10;

@Component({
    selector: 'app-properties-list',
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        NgTemplateOutlet,
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
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    // Prerendering this route used to bake the build machine's failed fetch -
    // literally "Failed to load properties." - into the static HTML that ships.
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    readonly cityList = Object.values(cityEnum);

    readonly pageSizeOptions = [10, 25, 50];

    // Filters - uncommitted until Apply is pressed, so a half-typed bound never becomes a
    // request. The search spans title and district. All of them hold
    // the raw text of their box, bounds included - see bound().
    readonly title = signal<string>('');
    readonly city = signal<string>('');
    readonly district = signal<string>('');
    readonly market = signal<string>('');
    readonly buildingType = signal<string>('');
    readonly seller = signal<string>('');
    readonly website = signal<string>('');
    readonly priceMin = signal<string>('');
    readonly priceMax = signal<string>('');
    readonly pricePerMeterMin = signal<string>('');
    readonly pricePerMeterMax = signal<string>('');
    readonly areaMin = signal<string>('');
    readonly areaMax = signal<string>('');
    readonly floorMin = signal<string>('');
    readonly floorMax = signal<string>('');
    readonly priceChangeMin = signal<string>('');
    readonly priceChangeMax = signal<string>('');
    readonly snapshotCountMin = signal<string>('');
    readonly snapshotCountMax = signal<string>('');
    readonly search = signal<string>('');

    /** Filter controls shared by desktop and mobile, independent of display columns. */
    readonly filters: readonly TableColumn[] = [
        { key: 'title', label: 'Title', filter: 'text', value: this.title, placeholder: 'Contains…' },
        {
            key: 'city', label: 'City', filter: 'select', value: this.city,
            options: this.cityList.map(city => ({ value: city, label: city }))
        },
        {
            key: 'webName', label: 'Website', filter: 'select', value: this.website,
            options: [WebName.Olx, WebName.Morizon, WebName.NieruchomosciOnline]
                .map(value => ({ value: String(value), label: portalName(value) }))
        },
        { key: 'district', label: 'District', filter: 'text', value: this.district, placeholder: 'Contains…' },
        {
            key: 'market', label: 'Market', filter: 'select', value: this.market,
            options: [{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }]
        },
        { key: 'buildingType', label: 'Building type', filter: 'text', value: this.buildingType, placeholder: 'e.g. blok, kamienica' },
        {
            key: 'private', label: 'Seller', filter: 'select', value: this.seller,
            options: [{ value: 'true', label: 'Private owner' }, { value: 'false', label: 'Agency / business' }]
        },
        { key: 'price', label: 'Price', filter: 'range', numeric: true, min: this.priceMin, max: this.priceMax },
        {
            key: 'pricePerMeter', label: 'Price / m²', filter: 'range', numeric: true,
            min: this.pricePerMeterMin, max: this.pricePerMeterMax
        },
        { key: 'area', label: 'Area', filter: 'range', numeric: true, min: this.areaMin, max: this.areaMax },
        { key: 'floor', label: 'Floor', filter: 'range', numeric: true, min: this.floorMin, max: this.floorMax },
        {
            key: 'priceChange', label: 'Change', filter: 'range', numeric: true,
            min: this.priceChangeMin, max: this.priceChangeMax
        },
        {
            key: 'snapshotCount', label: 'Snapshots', filter: 'range', numeric: true,
            min: this.snapshotCountMin, max: this.snapshotCountMax
        },
        // When a scrape last found the offer listed: the date of its newest snapshot. It is
        // the default sort, newest first. No filter box, because the API takes no date bounds.
        { key: 'lastSeen', label: 'Latest snapshot', filter: 'none' }
    ];

    /** Visible columns, also used by the mobile sort picker. */
    readonly columns: readonly ColumnBase[] = [
        { key: 'title', label: 'Title' },
        { key: 'city', label: 'Location' },
        { key: 'price', label: 'Price', numeric: true },
        { key: 'pricePerMeter', label: 'Price / m²', numeric: true },
        { key: 'area', label: 'Area', numeric: true },
        { key: 'priceChange', label: 'Change', numeric: true },
        { key: 'snapshotCount', label: 'Snapshots', numeric: true },
        { key: 'lastSeen', label: 'Latest snapshot' }
    ];

    /** Clear and shared links cover all filters, including fields without a table column. */
    private readonly filterFields: readonly FilterField[] = [
        { name: 'search', box: this.search, accepts: () => true },
        ...this.filters.flatMap((column): FilterField[] => {
            switch (column.filter) {
                case 'range': {
                    const isBound = (raw: string) => bound(raw) !== undefined;
                    return [
                        { name: `${column.key}Min`, box: column.min, accepts: isBound },
                        { name: `${column.key}Max`, box: column.max, accepts: isBound }
                    ];
                }
                case 'select':
                    return [{
                        name: column.key, box: column.value,
                        accepts: raw => column.options.some(option => option.value === raw)
                    }];
                case 'text':
                    return [{ name: column.key, box: column.value, accepts: () => true }];
                case 'none':
                    return [];
            }
        })
    ];

    /** What the table can be sorted by: every visible column, the latest snapshot included. */
    private readonly sortKeys: readonly string[] = this.columns.map(column => column.key);

    // Sort
    readonly sortBy = signal<string>(DEFAULT_SORT_BY);
    readonly sortDir = signal<'asc' | 'desc'>(DEFAULT_SORT_DIR);

    // Paging
    readonly page = signal<number>(1);
    readonly pageSize = signal<number>(DEFAULT_PAGE_SIZE);

    readonly properties = new AsyncResource<PagedResult<PropertyListItem>>();

    // MatPaginator is zero-based; the API is one-based.
    readonly pageIndex = computed(() => this.page() - 1);

    /** The committed query. Writing to it is what triggers a request - and updates the URL. */
    private readonly request = signal<PropertyQuery>({});

    /**
     * The query string the page last wrote, or found on arrival. Its own writes echo back
     * through the route's query params; this is how they are told apart from a link.
     */
    private written: Params = {};

    /** Whether anything is typed into a filter, applied or not - what Clear can undo. */
    readonly hasFilters = computed(() =>
        this.filterValues().some(value => value().trim().length > 0));

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
     *
     * Only the filters the map itself can apply are listed. The columns it knows nothing
     * about - the price change and the snapshot count, which are history, not location -
     * narrow the table alone, which the panel's own wording already allows for.
     */
    private readonly mapFilters = computed<MapPointFilters>(() => {
        const {
            title, district, market, buildingType, private: privateSeller, priceMin, priceMax, areaMin, areaMax,
            pricePerMeterMin, pricePerMeterMax, floorMin, floorMax, search
        } = this.request();
        return {
            title, district, market, buildingType, private: privateSeller, priceMin, priceMax, areaMin, areaMax,
            pricePerMeterMin, pricePerMeterMax, floorMin, floorMax, search
        };
    }, { equal: sameFields });

    /** What the map draws: the current offers that pass the applied filters. */
    readonly mapMatches = computed(() => {
        const points = this.mapPoints.data();
        return points ? filterMapPoints(points, this.mapFilters()) : null;
    });

    constructor() {
        // A reloaded or shared link asks for what it names, starting with the first request.
        const arrival = this.route.snapshot.queryParamMap;
        this.written = paramsOf(arrival);
        this.restore(arrival);
        this.request.set(this.buildQuery());

        const listRequest = computed(() => ({ query: this.request(), revision: this.realEstateData.revision() }));
        toObservable(listRequest).pipe(
            map(({ query }) => query),
            filter(() => this.isBrowser),
            tap(query => this.writeUrl(query)),
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

        this.followQueryParams();
        this.wireMapPoints();
    }

    applyFilters(): void {
        this.page.set(1);
        this.commit();
    }

    /** Empties every filter and applies that, so Clear never needs a second click. */
    clearFilters(): void {
        for (const value of this.filterValues()) {
            value.set('');
        }
        this.applyFilters();
    }

    /** Writes what was typed into one filter box. Applying it is still Apply's job. */
    setFilter(target: WritableSignal<string>, event: Event): void {
        target.set((event.target as HTMLInputElement | HTMLSelectElement).value);
    }

    /** Every filter box on the page, the search included: what Clear empties. */
    private filterValues(): WritableSignal<string>[] {
        return this.filterFields.map(field => field.box);
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

    toggleSortDir(): void {
        this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
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

    /**
     * Passes a date through only if it parses, so the template can fall back to a dash.
     * DatePipe throws on anything it cannot convert, which would take every row down with
     * it, as it once did on the history page.
     */
    protected validDate(value: string | null | undefined): string | null {
        return validSnapshotDate(value);
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
     * Fills the filter boxes, the sort and the paging from a query string. A value the
     * page could not have written - an unknown sort key, a bound that is not a number, a
     * page size the paginator does not offer, a city it does not list - falls back to the
     * default instead of reaching the API.
     */
    private restore(params: ParamMap): void {
        for (const { name, box, accepts } of this.filterFields) {
            const raw = params.get(name) ?? '';
            box.set(accepts(raw) ? raw : '');
        }

        const sortBy = params.get('sortBy');
        this.sortBy.set(sortBy !== null && this.sortKeys.includes(sortBy) ? sortBy : DEFAULT_SORT_BY);
        const sortDir = params.get('sortDir');
        this.sortDir.set(sortDir === 'asc' || sortDir === 'desc' ? sortDir : DEFAULT_SORT_DIR);

        // Number(null) is 0, so a missing page lands on the first one like a bad one does.
        const page = Number(params.get('page'));
        this.page.set(Number.isInteger(page) && page >= 1 ? page : 1);
        const pageSize = Number(params.get('pageSize'));
        this.pageSize.set(this.pageSizeOptions.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE);
    }

    /**
     * Mirrors the committed query into the address bar, so a reload or a shared link
     * brings back the same filters, sort and page. The half-typed boxes stay out of it,
     * as they stay out of the request. replaceUrl: a sort or a page turn is not a step
     * worth a Back press - Back leaves the list rather than replaying it.
     */
    private writeUrl(query: PropertyQuery): void {
        const queryParams = toQueryParams(query);
        this.written = queryParams;
        // The same URL again - a retry, or the untouched page - is a navigation the
        // router already ignores.
        void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    }

    /**
     * Follows a query string the page did not write: the toolbar's Properties link clicked
     * from a filtered list keeps this component and changes only the query, and without
     * this the address bar went bare while the table stayed filtered. The page's own writes
     * come back through here too and are skipped - following them would put the committed
     * query back over whatever is half-typed.
     */
    private followQueryParams(): void {
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
            if (sameParams(paramsOf(params), this.written)) return;

            this.written = paramsOf(params);
            this.restore(params);
            this.commit();
        });
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
            nonce: this.mapReloadNonce(),
            revision: this.realEstateData.revision()
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
            title: this.title() || undefined,
            city: this.city() || undefined,
            district: this.district() || undefined,
            market: this.market() || undefined,
            buildingType: this.buildingType().trim() || undefined,
            webName: bound(this.website()),
            private: this.seller() === '' ? undefined : this.seller() === 'true',
            priceMin: bound(this.priceMin()),
            priceMax: bound(this.priceMax()),
            pricePerMeterMin: bound(this.pricePerMeterMin()),
            pricePerMeterMax: bound(this.pricePerMeterMax()),
            areaMin: bound(this.areaMin()),
            areaMax: bound(this.areaMax()),
            floorMin: bound(this.floorMin()),
            floorMax: bound(this.floorMax()),
            priceChangeMin: bound(this.priceChangeMin()),
            priceChangeMax: bound(this.priceChangeMax()),
            snapshotCountMin: bound(this.snapshotCountMin()),
            snapshotCountMax: bound(this.snapshotCountMax()),
            search: this.search() || undefined
        };
    }
}

/**
 * A committed query as the page's query string: every field that is set, less the
 * defaults. The bounds are written as the numbers that were sent, not as typed.
 */
function toQueryParams(query: PropertyQuery): Params {
    const defaults: PropertyQuery = {
        page: 1, pageSize: DEFAULT_PAGE_SIZE, sortBy: DEFAULT_SORT_BY, sortDir: DEFAULT_SORT_DIR
    };
    const params: Params = {};
    for (const key of Object.keys(query) as (keyof PropertyQuery)[]) {
        const value = query[key];
        if (value === undefined || value === null || value === '' || value === defaults[key]) continue;
        params[key] = String(value);
    }
    return params;
}

/** A query string as plain name/value pairs - the first value of a repeated name. */
function paramsOf(params: ParamMap): Params {
    return Object.fromEntries(params.keys.map(key => [key, params.get(key)]));
}

function sameParams(a: Params, b: Params): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length
        && keys.every(key => b[key] !== undefined && String(a[key]) === String(b[key]));
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
    return a.length === b.length && a.every((item, i) => item === b[i]);
}

function sameFields(a: MapPointFilters, b: MapPointFilters): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MapPointFilters>;
    return [...keys].every(key => a[key] === b[key]);
}
