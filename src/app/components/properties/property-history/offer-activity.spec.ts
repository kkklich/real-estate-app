import { offerActivity, sourceLink } from './offer-activity';
import { PropertyHistory, PropertyHistoryEntry } from '../../../models/propertyHistory';

describe('offerActivity', () => {
    const entry = (date: string, price: number, url = 'https://www.olx.pl/a', webName = 0): PropertyHistoryEntry =>
        ({ date, price, url, webName, pricePerMeter: 0, priceChange: -999 });
    const history = (entries: PropertyHistoryEntry[]) => ({ url: 'https://www.olx.pl/a', webName: 0, entries } as PropertyHistory);

    it('sorts observations and compares reductions within one link, skipping unknown prices', () => {
        const result = offerActivity(history([
            entry('2026-03-01', 600000), entry('2026-01-01', 700000), entry('2026-02-01', 0),
            entry('invalid', 1), entry('2026-01-02', 500000, 'https://www.morizon.pl/b', 1)
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first', 'drop']);
        expect(result.events[1].change).toBe(-100000);
        expect(result.related.length).toBe(1);
    });

    it('does not infer a return from a gap, but identifies a new link on the same portal', () => {
        const result = offerActivity(history([
            entry('2026-01-01', 700000), entry('2026-06-01', 700000),
            entry('2026-07-01', 600000, 'https://www.olx.pl/new')
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first', 'repost']);
        expect(result.related).toEqual([]);
    });

    it('deduplicates tracking links and excludes the selected offer', () => {
        const result = offerActivity(history([
            entry('2026-01-01', 700000),
            entry('2026-02-01', 700000, 'https://www.morizon.pl/b?tracking=1', 1),
            entry('2026-03-01', 700000, 'https://www.morizon.pl/b#details', 1)
        ]));
        expect(result.related.length).toBe(1);
        expect(result.events.map(e => e.kind)).toEqual(['first']);
    });

    it('handles empty history and unsafe links, and resolves legacy Morizon links', () => {
        expect(offerActivity(history([]))).toEqual({ events: [], related: [] });
        expect(sourceLink('javascript:alert(1)', 0)).toBeNull();
        expect(sourceLink('//example.com/offer', 1)).toBeNull();
        expect(sourceLink('/oferta/mieszkanie', 1)).toBe('https://www.morizon.pl/oferta/mieszkanie');
    });

    it('normalizes zone-less API timestamps before sorting mixed timezone snapshots', () => {
        const result = offerActivity(history([
            entry('2026-06-01T10:00:00', 600000),
            entry('2026-06-01T10:30:00+02:00', 700000)
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first', 'drop']);
        expect(result.events[0].date).toBe('2026-06-01T10:30:00+02:00');
        expect(result.events[1].date).toBe('2026-06-01T10:00:00Z');
        expect(result.events[1].change).toBe(-100000);
    });

    it('does not call coexisting source links a re-post, even when the overlap is later', () => {
        const result = offerActivity(history([
            entry('2026-01-01', 700000),
            entry('2026-02-01', 600000, 'https://www.olx.pl/parallel'),
            entry('2026-03-01', 700000)
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first']);
    });

    it('does not infer a re-post from timestamps within a single UTC scrape day', () => {
        const result = offerActivity(history([
            entry('2026-01-01T10:00:00', 700000),
            entry('2026-01-01T11:00:00', 600000, 'https://www.olx.pl/parallel')
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first']);
    });

    it('retains a related link with an unknown date and recovers its earliest valid date', () => {
        const related = entry('invalid', 600000, 'https://www.morizon.pl/b', 1);
        const result = offerActivity(history([related]));
        expect(result.events).toEqual([]);
        expect(result.related.length).toBe(1);
        expect(result.related[0].date).toBeNull();
        const recovered = offerActivity(history([
            related, { ...related, date: '2026-02-01T10:00:00' }, { ...related, date: '2026-01-01T10:00:00' }
        ]));
        expect(recovered.related[0].date).toBe('2026-01-01T10:00:00Z');
    });

    it('treats legacy relative and absolute Morizon links as the same source offer', () => {
        const result = offerActivity(history([
            entry('2026-01-01', 700000, '/oferta/flat', 1),
            entry('2026-02-01', 600000, 'https://www.morizon.pl/oferta/flat?tracking=1', 1)
        ]));
        expect(result.events.map(e => e.kind)).toEqual(['first', 'drop']);
        expect(result.related.length).toBe(1);
    });
});
