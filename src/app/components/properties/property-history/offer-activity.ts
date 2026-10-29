import { PropertyHistory, PropertyHistoryEntry } from '../../../models/propertyHistory';
import { validSnapshotDate } from '../../../services/snapshot-date';
import { normalizeOfferUrl } from './offer-url';

export interface OfferEvent {
    date: string;
    kind: 'first' | 'drop' | 'repost';
    url: string;
    webName: number;
    change?: number;
}

/** Only HTTP(S) source links; old Morizon snapshots used relative paths. */
export function sourceLink(url: string, webName: number): string | null {
    try {
        const value = url.trim();
        const resolved = webName === 1 && value.startsWith('/') && !value.startsWith('//')
            ? new URL(value, 'https://www.morizon.pl') : new URL(value);
        return ['https:', 'http:'].includes(resolved.protocol) ? resolved.href : null;
    } catch { return null; }
}

export function offerKey(url: string, webName: number): string {
    const href = sourceLink(url, webName);
    return href ? `${webName}:${normalizeOfferUrl(href)}` : '';
}

interface SourceOffer {
    key: string;
    webName: number;
    url: string;
    date: string | null;
    lastDate: string | null;
}

export function offerActivity(history: PropertyHistory) {
    // Links remain useful even if a snapshot has a malformed timestamp.
    const links = new Map<string, SourceOffer>();
    for (const entry of history.entries) {
        const key = offerKey(entry.url, entry.webName);
        if (!key) continue;
        const date = validSnapshotDate(entry.date);
        const link = links.get(key);
        if (!link) {
            links.set(key, { key, webName: entry.webName, url: sourceLink(entry.url, entry.webName)!, date, lastDate: date });
        } else if (date) {
            if (!link.date || Date.parse(date) < Date.parse(link.date)) link.date = date;
            if (!link.lastDate || Date.parse(date) > Date.parse(link.lastDate)) link.lastDate = date;
        }
    }
    const entries = history.entries
        .map(entry => ({ ...entry, date: validSnapshotDate(entry.date) }))
        .filter((entry): entry is PropertyHistoryEntry => entry.date !== null)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const events: OfferEvent[] = [];
    const seen = new Set<string>();
    const prices = new Map<string, number>();
    for (const entry of entries) {
        const key = offerKey(entry.url, entry.webName);
        const href = sourceLink(entry.url, entry.webName) ?? '';
        if (!events.length) events.push({ date: entry.date, kind: 'first', url: href, webName: entry.webName });
        if (key && !seen.has(key)) {
            const day = new Date(entry.date).toISOString().slice(0, 10);
            // A re-post requires a previous link to have ended on an earlier UTC day.
            // Coexisting links (including later overlaps) are not evidence of a return.
            const previousLinks = Array.from(links.values()).filter(link =>
                link.key !== key && link.webName === entry.webName && link.date && Date.parse(link.date) < Date.parse(entry.date));
            if (previousLinks.length && previousLinks.every(link => link.lastDate &&
                new Date(link.lastDate).toISOString().slice(0, 10) < day)) {
                events.push({ date: entry.date, kind: 'repost', url: href, webName: entry.webName });
            }
            seen.add(key);
        }
        // Another portal's asking price is not a reduction of this source offer.
        const previous = prices.get(key);
        if (key && Number.isFinite(entry.price) && entry.price > 0) {
            if (previous !== undefined && entry.price < previous) {
                events.push({ date: entry.date, kind: 'drop', url: href, webName: entry.webName, change: entry.price - previous });
            }
            prices.set(key, entry.price);
        }
    }
    const own = offerKey(history.url, history.webName);
    return {
        events,
        related: Array.from(links.values()).filter(link => link.key !== own && link.webName !== history.webName)
    };
}
