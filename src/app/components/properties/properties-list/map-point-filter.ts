import { MapPoint } from '../../../models/mapPoint';
import { PropertyQuery } from '../../../models/propertyQuery';

/**
 * The list filters the properties page sets, which the map applies to its offers too.
 *
 * The price-change and snapshot-count columns are missing on purpose: a map point carries
 * only the latest scrape, with no history to compare against, so those two narrow the
 * table alone.
 */
export type MapPointFilters = Pick<PropertyQuery,
    'title' | 'district' | 'market' | 'buildingType' | 'private' | 'priceMin' | 'priceMax' | 'areaMin' | 'areaMax'
    | 'pricePerMeterMin' | 'pricePerMeterMax' | 'floorMin' | 'floorMax' | 'search' | 'url'>;

/** The API's English aliases for the Polish market names it stores. */
const MARKET_ALIASES: Record<string, string> = {
    primary: 'Pierwotny',
    secondary: 'Wtórny'
};

/**
 * The offers the properties list would return for `filters`, filtered the way the API's
 * GetPagedAsync does it: inclusive bounds, a whole market name, and a substring search
 * over title and district. MySQL compares those strings ignoring case and accents, so
 * this does too - "wtorny" and "Wtórny" are the same market there.
 */
export function filterMapPoints(points: readonly MapPoint[], filters: MapPointFilters): MapPoint[] {
    const marketFilter = filters.market?.trim() ?? '';
    const market = marketFilter ? fold(MARKET_ALIASES[marketFilter.toLowerCase()] ?? marketFilter) : null;
    const title = substring(filters.title);
    const district = substring(filters.district);
    const buildingType = filters.buildingType?.trim() ? fold(filters.buildingType.trim()) : null;
    const search = substring(filters.search);
    const url = filters.url?.trim().toLowerCase() || null;

    return points.filter(point =>
        (market === null || fold(point.market ?? '') === market)
        && (buildingType === null || fold(point.buildingType ?? '').replace(/ +$/, '') === buildingType)
        && (filters.private === undefined || point.private === filters.private)
        && withinStated(point.price, filters.priceMin, filters.priceMax)
        && withinStated(point.area, filters.areaMin, filters.areaMax)
        && withinStated(point.pricePerMeter, filters.pricePerMeterMin, filters.pricePerMeterMax)
        // Floor 0 is the ground floor, a real value, so it is bounded as it stands.
        && within(point.floor, filters.floorMin, filters.floorMax)
        && (title === null || fold(point.title ?? '').includes(title))
        && (district === null || fold(point.location?.district ?? '').includes(district))
        && (url === null || (point.url ?? '').toLowerCase().includes(url))
        && (search === null
            || fold(point.title ?? '').includes(search)
            || fold(point.location?.district ?? '').includes(search))
    );
}

/**
 * A substring filter folded for comparison; null when the box is empty. Trailing spaces
 * are dropped and leading ones kept, as the API's OfferText.Fold does - keeping them made
 * "krak " match in the table and nothing on the map.
 */
function substring(value: string | undefined): string | null {
    return value?.trim() ? fold(value).replace(/ +$/, '') : null;
}

function within(value: number, min: number | undefined, max: number | undefined): boolean {
    return (min == null || value >= min) && (max == null || value <= max);
}

/**
 * Bounds on a value where 0 means the portal did not state it (price, price per m², area):
 * with either bound set such a value is out, as in the API's OfferQuery - read as a real 0
 * it slipped under every maximum, so "up to 300k" drew the offers of unknown price too.
 */
function withinStated(value: number, min: number | undefined, max: number | undefined): boolean {
    if (min == null && max == null) return true;
    return value > 0 && within(value, min, max);
}

/** Lowercase, without diacritics. Leaves "ł" alone: it has no decomposed form. */
function fold(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
