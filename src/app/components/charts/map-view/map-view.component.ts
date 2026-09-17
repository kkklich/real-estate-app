import { Component, ElementRef, LOCALE_ID, OnDestroy, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { formatNumber } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import * as GeoJSON from 'geojson';
import { MapPoint } from '../../../models/mapPoint';
import { environment } from '../../../../enviroments/environment';

/** One offer reduced to what the map actually draws. */
interface PlottedPoint {
    lat: number;
    lng: number;
    label: string;
    value: unknown;
    url: string;
    color: string;
}

/** One legend row: a swatch and the words that say what its color means. */
interface LegendEntry {
    color: string;
    label: string;
}

/** Everything drawn for one group-by field: the dots and the key to their colors. */
interface MapPlot {
    fieldLabel: string;
    points: PlottedPoint[];
    legend: LegendEntry[];
    /**
     * Words a value the way its legend row does. Called per opened popup rather than
     * per dot: formatting every offer up front cost ~100 ms at 60k offers.
     */
    describe(value: unknown): string;
}

/** How one group-by field turns a value into a dot color, a legend row and popup text. */
interface ColorScale {
    legend: LegendEntry[];
    colorOf(value: unknown): string;
    describe(value: unknown): string;
}

interface FieldFormat {
    /** Legend title and popup label. */
    label: string;
    /** Angular digitsInfo and unit, for numeric fields. */
    digits?: string;
    unit?: string;
    /** Wording of a categorical value. */
    category?: (value: string) => string;
    /**
     * Color the most common categories rather than the first ones alphabetically. Only
     * for fields whose values differ per city anyway, where no color could stay stable.
     */
    rankByCount?: boolean;
}

const FIELD_FORMATS: Record<string, FieldFormat> = {
    price: { label: 'Price', digits: '1.0-0', unit: 'PLN' },
    pricePerMeter: { label: 'Price / m²', digits: '1.0-0', unit: 'PLN / m²' },
    area: { label: 'Area', digits: '1.0-1', unit: 'm²' },
    floor: { label: 'Floor', digits: '1.0-0' },
    market: { label: 'Market', category: capitalize },
    buildingType: { label: 'Building type', category: capitalize },
    private: { label: 'Owner', category: value => (value === 'true' ? 'Private owner' : 'Agency / developer') },
    // ~140 districts per city: alphabetically, the three colored ones were a few dozen offers.
    'location.district': { label: 'District', rankByCount: true }
};

/**
 * Magnitude (price, area, floor): one hue, light to dark, so low-to-high still reads
 * under any color vision deficiency and in greyscale. The red-to-blue ramp this
 * replaced was not even ordered by lightness - its middle was darker than both ends.
 */
const SEQUENTIAL_STEPS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'];

/**
 * Identity (market, building type, owner, district). On a map any two dots can end
 * up side by side, and three hues are the most that stay pairwise distinct under
 * protanopia and deuteranopia; every further category folds into OTHER_COLOR.
 */
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];

/** Folded and blank categories. A mid grey would be indistinguishable from the aqua for deuteranopes. */
const OTHER_COLOR = '#52514e';

/** A numeric field with no value. OTHER_COLOR would sit too close to the darkest blue step. */
const NO_DATA_COLOR = '#898781';

/**
 * How the map frames its offers. The zoom cap keeps a single offer, or one building's
 * worth, from zooming in to street-level detail; at 15 clusters have already split.
 */
const FIT_OPTIONS: maplibregl.FitBoundsOptions = { padding: 50, maxZoom: 15 };

@Component({
    selector: 'app-map-view',
    imports: [],
    templateUrl: './map-view.component.html',
    styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements OnDestroy {

    private static readonly DEFAULT_ZOOM = 10;

    /** The offers to plot. The map is created once there is at least one. */
    readonly points = input<readonly MapPoint[] | null>(null);

    /** The offer field the dot colors and the legend describe, e.g. 'pricePerMeter' or 'location.district'. */
    readonly groupedBy = input('market');

    private readonly locale = inject(LOCALE_ID);
    private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

    private mapInstance?: maplibregl.Map;
    private popup?: maplibregl.Popup;
    private mapInitialized = false;

    private readonly LIGHT_STYLE =
        `https://api.maptiler.com/maps/streets-v2/style.json?key=${environment.maptilerKey}`;

    // Colors are computed once per data / groupedBy change.
    private readonly processedData = computed(() =>
        plotPoints(this.points() ?? [], this.groupedBy(), this.locale)
    );

    /** What each dot color means - without it the colors explain nothing. */
    protected readonly legend = computed(() => {
        const { fieldLabel, legend } = this.processedData();
        return legend.length > 0 ? { title: fieldLabel, entries: legend } : null;
    });

    constructor() {
        this.setupMapEffect();
        this.setupViewportEffect();
    }

    private setupMapEffect(): void {
        effect(() => {
            const data = this.processedData().points;
            // Tracked, not untracked: the effect must re-run once the view child resolves.
            const container = this.mapContainer()?.nativeElement;

            if (!container) return;

            untracked(() => {
                if (this.mapInitialized) {
                    // Empty data too: a filter that matches nothing must clear the old dots.
                    this.updateMapData(data);
                } else if (data.length > 0) {
                    this.initMap(container, data);
                }
            });
        });
    }

    // Tracks ONLY the offer set - changing groupedBy recolors the same offers and must
    // not reset the pan/zoom the user set. A new set (another city, other filters) is
    // framed afresh.
    private setupViewportEffect(): void {
        effect(() => {
            this.points();

            untracked(() => {
                if (this.mapInitialized) {
                    this.fitBounds(this.processedData().points);
                }
            });
        });
    }

    private initMap(container: HTMLElement, data: PlottedPoint[]): void {
        // Guard: data can arrive again while the style is still loading; creating a
        // second Map on the same container would leak a WebGL context.
        if (this.mapInstance) return;

        const bounds = boundsOf(data);
        this.mapInstance = new maplibregl.Map({
            container,
            style: this.LIGHT_STYLE,
            // Opens already framed on the offers. Center and zoom only apply if the
            // container is too small to fit the bounds into.
            bounds,
            fitBoundsOptions: FIT_OPTIONS,
            center: bounds.getCenter(),
            zoom: MapViewComponent.DEFAULT_ZOOM
        });

        this.mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

        this.mapInstance.on('load', () => {
            this.mapInitialized = true;
            // read the signal fresh - the data captured when init started may be stale by now
            this.addMapLayers(untracked(() => this.processedData().points));
        });
    }

    private addMapLayers(data: PlottedPoint[]): void {
        const map = this.mapInstance;
        if (!map) return;

        map.addSource('properties', {
            type: 'geojson',
            data: buildGeoJson(data),
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        // Neutral on purpose: the radius and the printed count already say how many offers
        // a cluster holds, and the old cyan / yellow / pink steps read as extra categories
        // that the legend does not list.
        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'properties',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': '#ffffff',
                'circle-stroke-color': '#22294a',
                'circle-stroke-width': 2,
                'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'properties',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            },
            paint: {
                'text-color': '#22294a'
            }
        });

        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'properties',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['get', 'color'],
                'circle-radius': 8,
                // 2px white ring: keeps touching dots apart and lifts them off the basemap.
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });

        map.on('click', 'unclustered-point', e => this.showPopup(map, e));

        this.fitBounds(data);
    }

    /**
     * One popup instance, moved on each click. Creating a new Popup per click left
     * every previously opened one sitting on the map.
     */
    private showPopup(map: maplibregl.Map, e: maplibregl.MapLayerMouseEvent): void {
        const feature = e.features?.[0];
        if (!feature) return;

        this.popup ??= new maplibregl.Popup({ closeButton: true, closeOnClick: true });
        this.popup
            .setLngLat(e.lngLat)
            .setDOMContent(this.buildPopupContent(feature.properties ?? {}))
            .addTo(map);
    }

    /**
     * Built as DOM nodes rather than an HTML string: titles and urls come from
     * scraped portals, and textContent / href cannot be talked into running markup.
     */
    private buildPopupContent(props: Record<string, unknown>): HTMLElement {
        const root = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = String(props['label'] ?? '');
        root.append(title, document.createElement('br'));
        // Worded exactly like the legend row, so a dot can be matched to its color.
        const plot = this.processedData();
        root.append(document.createTextNode(`${plot.fieldLabel}: ${plot.describe(props['value'])}`));

        const url = String(props['url'] ?? '');
        if (/^https?:\/\//i.test(url)) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = url;
            root.append(document.createElement('br'), link);
        }

        return root;
    }

    private updateMapData(data: PlottedPoint[]): void {
        const source = this.mapInstance?.getSource('properties') as maplibregl.GeoJSONSource | undefined;
        source?.setData(buildGeoJson(data));
    }

    private fitBounds(data: PlottedPoint[]): void {
        if (data.length === 0) return;

        this.mapInstance?.fitBounds(boundsOf(data), FIT_OPTIONS);
    }

    ngOnDestroy(): void {
        this.popup?.remove();
        this.popup = undefined;
        this.mapInstance?.remove();
        this.mapInstance = undefined;
        this.mapInitialized = false;
    }
}

/** Reads a dotted path such as 'location.district' off an offer. */
function readNested(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (acc, part) => (acc !== null && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[part]
            : undefined),
        obj
    );
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function plotPoints(points: readonly MapPoint[], groupedBy: string, locale: string): MapPlot {
    const format = FIELD_FORMATS[groupedBy] ?? { label: groupedBy };

    // Offers the scraper never geocoded would otherwise be drawn at [0,0] - and they
    // must not stretch the legend to values that appear nowhere on the map.
    const located = points.filter(p => isFiniteNumber(p.location?.lat) && isFiniteNumber(p.location?.lon));
    const values = located.map(p => readNested(p, groupedBy));

    const scale = values.some(isFiniteNumber)
        ? numericScale(values, format, locale)
        : categoricalScale(values, format, locale);

    return {
        fieldLabel: format.label,
        legend: scale.legend,
        describe: scale.describe,
        points: located.map((point, i) => ({
            lat: point.location.lat,
            lng: point.location.lon,
            label: point.title ?? 'Unknown',
            value: values[i],
            url: point.url ?? '',
            color: scale.colorOf(values[i])
        }))
    };
}

/**
 * Quantile bands, not equal-width ones: prices are right-skewed, and a handful of
 * luxury listings would otherwise push nearly every offer into the lowest band.
 */
function numericScale(values: unknown[], format: FieldFormat, locale: string): ColorScale {
    const digits = format.digits ?? '1.0-2';
    const fractionDigits = Number(/-(\d+)$/.exec(digits)?.[1] ?? 0);
    const unit = format.unit ? ` ${format.unit}` : '';
    const text = (value: number): string => formatNumber(value, locale, digits);
    // A value rounded the way the legend shows it, back as a number.
    const shown = (value: number): number => Number(formatNumber(value, 'en-US', digits).replace(/,/g, ''));

    // Sorted copy instead of Math.min(...values): spreading one argument per offer
    // overflows the call stack once a city returns tens of thousands of them.
    const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
    const topShown = shown(sorted[sorted.length - 1]);

    // Band edges sit half a display step above a quantile's rounded value: everything
    // below an edge displays as at most that value, everything above as more. Edges on
    // raw values let rounding print one number in two rows ("23,1 – 30", "30 – 36,1" for
    // areas stored with 2 decimals). Ties - floor has only a few distinct values - collapse
    // into fewer bands rather than empty ones.
    const edges: number[] = [];
    let previous = Number.NEGATIVE_INFINITY;
    for (let k = 1; k < SEQUENTIAL_STEPS.length; k++) {
        const quantile = shown(sorted[Math.ceil((k * sorted.length) / SEQUENTIAL_STEPS.length) - 1]);
        if (quantile > previous && quantile < topShown) {
            // toFixed strips the float error of the addition, leaving the exact decimal
            // half-way point on which formatNumber's half-up rounding turns.
            edges.push(Number((quantile + 0.5 * 10 ** -fractionDigits).toFixed(fractionDigits + 1)));
            previous = quantile;
        }
    }

    const colors = spreadSteps(SEQUENTIAL_STEPS, edges.length + 1);
    const bandOf = (value: number): number => {
        let band = 0;
        while (band < edges.length && value >= edges[band]) band++;
        return band;
    };

    // Each row names the lowest and highest value actually inside its band, so rows
    // never overlap and never promise a value that no offer has.
    const lowest = colors.map(() => Number.POSITIVE_INFINITY);
    const highest = colors.map(() => Number.NEGATIVE_INFINITY);
    for (const value of sorted) {
        const band = bandOf(value);
        lowest[band] = Math.min(lowest[band], value);
        highest[band] = Math.max(highest[band], value);
    }

    const legend: LegendEntry[] = colors.map((color, band) => {
        const from = text(lowest[band]);
        const to = text(highest[band]);
        return { color, label: (from === to ? from : `${from} – ${to}`) + unit };
    });

    if (sorted.length < values.length) {
        legend.push({ color: NO_DATA_COLOR, label: 'No data' });
    }

    return {
        legend,
        colorOf: value => (isFiniteNumber(value) ? colors[bandOf(value)] : NO_DATA_COLOR),
        describe: value => (isFiniteNumber(value) ? text(value) + unit : 'No data')
    };
}

/** `count` steps spread evenly across the ramp, always keeping both ends. */
function spreadSteps(steps: string[], count: number): string[] {
    if (count === 1) return [steps[Math.floor(steps.length / 2)]];
    return Array.from({ length: count }, (_, i) => steps[Math.round((i * (steps.length - 1)) / (count - 1))]);
}

/**
 * Colors go to categories in alphabetical order, not by how common they are, so a
 * building type keeps its color when the city changes - unless the field is marked
 * rankByCount.
 */
function categoricalScale(values: unknown[], format: FieldFormat, locale: string): ColorScale {
    const wording = format.category ?? ((value: string) => value);
    const keyOf = (value: unknown): string => String(value ?? '').trim();

    const names = new Map<string, string>();
    const counts = new Map<string, number>();
    let hasBlank = false;
    for (const value of values) {
        const key = keyOf(value);
        if (key === '') {
            hasBlank = true;
            continue;
        }
        if (!names.has(key)) names.set(key, wording(key));
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const alphabetical = ([, a]: [string, string], [, b]: [string, string]): number => a.localeCompare(b, locale);
    const named = [...names]
        .sort(format.rankByCount
            ? (a, b) => ((counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0)) || alphabetical(a, b)
            : alphabetical)
        .slice(0, CATEGORY_COLORS.length);
    const colorByKey = new Map(named.map(([key], i) => [key, CATEGORY_COLORS[i]]));

    const legend: LegendEntry[] = named.map(([, name], i) => ({ color: CATEGORY_COLORS[i], label: name }));

    const foldedCount = names.size - named.length;
    if (foldedCount > 0 || hasBlank) {
        legend.push({ color: OTHER_COLOR, label: otherLabel(foldedCount, hasBlank) });
    }

    return {
        legend,
        colorOf: value => colorByKey.get(keyOf(value)) ?? OTHER_COLOR,
        describe: value => names.get(keyOf(value)) ?? 'Not specified'
    };
}

function otherLabel(foldedCount: number, hasBlank: boolean): string {
    if (foldedCount === 0) return 'Not specified';
    const other = `Other (${foldedCount} more)`;
    return hasBlank ? `${other} or not specified` : other;
}

/** The smallest box around every point. Callers pass at least one point. */
function boundsOf(data: PlottedPoint[]): maplibregl.LngLatBounds {
    const bounds = new maplibregl.LngLatBounds();
    data.forEach(p => bounds.extend([p.lng, p.lat]));
    return bounds;
}

function buildGeoJson(data: PlottedPoint[]): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: data.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
                label: p.label,
                value: p.value,
                color: p.color,
                url: p.url
            }
        }))
    };
}
