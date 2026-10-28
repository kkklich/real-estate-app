/** API snapshot timestamps are stored in UTC; older responses omit the zone. */
export function validSnapshotDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value}Z` : value;
    return Number.isFinite(Date.parse(normalized)) ? normalized : null;
}
