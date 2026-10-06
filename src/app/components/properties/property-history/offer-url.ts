/**
 * An offer link as the API's PropertyComparer.NormalizeUrl compares it: trimmed, lower-
 * cased, without the query string, the fragment or trailing slashes. Snapshots of one
 * listing differ in their query strings all the time, so the raw links would count a
 * single listing as several. '' for a missing link, as there.
 */
export function normalizeOfferUrl(url: string | null | undefined): string {
    let normalized = (url ?? '').trim().toLowerCase();

    const queryStart = normalized.indexOf('?');
    if (queryStart >= 0) {
        normalized = normalized.substring(0, queryStart);
    }

    const fragmentStart = normalized.indexOf('#');
    if (fragmentStart >= 0) {
        normalized = normalized.substring(0, fragmentStart);
    }

    return normalized.replace(/\/+$/, '');
}
