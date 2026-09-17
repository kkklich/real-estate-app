import { MapPoint } from '../../../models/mapPoint';
import { PropertyQuery } from '../../../models/propertyQuery';

/** The list filters the properties page sets, which the map applies to its offers too. */
export type MapPointFilters = Pick<PropertyQuery, 'market' | 'priceMin' | 'priceMax' | 'areaMin' | 'areaMax' | 'search'>;

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
    const searchFilter = filters.search ?? '';
    const search = searchFilter.trim() ? fold(searchFilter) : null;

    return points.filter(point =>
        (market === null || fold(point.market ?? '') === market)
        && within(point.price, filters.priceMin, filters.priceMax)
        && within(point.area, filters.areaMin, filters.areaMax)
        && (search === null
            || fold(point.title ?? '').includes(search)
            || fold(point.location?.district ?? '').includes(search))
    );
}

function within(value: number, min: number | undefined, max: number | undefined): boolean {
    return (min == null || value >= min) && (max == null || value <= max);
}

/** Lowercase, without diacritics. Leaves "ł" alone: it has no decomposed form. */
function fold(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
