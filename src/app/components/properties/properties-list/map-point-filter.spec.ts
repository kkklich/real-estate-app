import { filterMapPoints } from './map-point-filter';
import { MapPoint } from '../../../models/mapPoint';

describe('filterMapPoints', () => {

    const point = (title: string, overrides: Partial<MapPoint> = {}): MapPoint => ({
        url: `https://example.com/${title}`, title, price: 500_000, pricePerMeter: 10_000, floor: 1,
        market: 'Wtórny', buildingType: 'blok', area: 50, private: false, color: '',
        location: { lat: 50, lon: 19.9, district: 'Podgórze' },
        ...overrides
    });

    const titles = (points: MapPoint[]): string[] => points.map(p => p.title);

    it('keeps every offer when no filter is applied', () => {
        const points = [point('a'), point('b')];

        expect(titles(filterMapPoints(points, {}))).toEqual(['a', 'b']);
        expect(titles(filterMapPoints(points, { market: '', search: '   ' }))).toEqual(['a', 'b']);
    });

    // The page sends the API's English aliases; the offers carry the stored Polish names.
    it('matches the market aliases against the stored market names', () => {
        const points = [
            point('primary', { market: 'Pierwotny' }),
            point('secondary', { market: 'Wtórny' }),
            point('secondary-no-accent', { market: 'wtorny' })
        ];

        expect(titles(filterMapPoints(points, { market: 'primary' }))).toEqual(['primary']);
        expect(titles(filterMapPoints(points, { market: 'secondary' }))).toEqual(['secondary', 'secondary-no-accent']);
        expect(titles(filterMapPoints(points, { market: 'Pierwotny' }))).toEqual(['primary']);
    });

    it('treats price and area bounds as inclusive', () => {
        const points = [
            point('cheap', { price: 300_000, area: 30 }),
            point('mid', { price: 500_000, area: 50 }),
            point('dear', { price: 900_000, area: 90 })
        ];

        expect(titles(filterMapPoints(points, { priceMin: 300_000, priceMax: 500_000 }))).toEqual(['cheap', 'mid']);
        expect(titles(filterMapPoints(points, { areaMin: 50 }))).toEqual(['mid', 'dear']);
        expect(titles(filterMapPoints(points, { areaMax: 30 }))).toEqual(['cheap']);
    });

    // A cleared number input is null in the form, but 0 is a real bound.
    it('applies a zero bound', () => {
        const points = [point('free', { price: 0 }), point('priced', { price: 1 })];

        expect(titles(filterMapPoints(points, { priceMax: 0 }))).toEqual(['free']);
    });

    it('searches title and district ignoring case and accents', () => {
        const points = [
            point('Mieszkanie ŚRÓDMIEŚCIE', { location: { lat: 50, lon: 19, district: 'Zabłocie' } }),
            point('Kawalerka', { location: { lat: 50, lon: 19, district: 'Nowa Huta' } }),
            point('Dom', { location: { lat: 50, lon: 19, district: 'Bronowice' } })
        ];

        expect(titles(filterMapPoints(points, { search: 'srodmiescie' }))).toEqual(['Mieszkanie ŚRÓDMIEŚCIE']);
        expect(titles(filterMapPoints(points, { search: 'nowa HUTA' }))).toEqual(['Kawalerka']);
        expect(titles(filterMapPoints(points, { search: 'zabłocie' }))).toEqual(['Mieszkanie ŚRÓDMIEŚCIE']);
    });

    it('requires every applied filter to match', () => {
        const points = [
            point('match', { market: 'Pierwotny', price: 400_000, title: 'Nowe osiedle' }),
            point('wrong-market', { market: 'Wtórny', price: 400_000, title: 'Nowe osiedle' }),
            point('too-dear', { market: 'Pierwotny', price: 800_000, title: 'Nowe osiedle' })
        ];

        const kept = filterMapPoints(points, { market: 'primary', priceMax: 500_000, search: 'osiedle' });

        expect(kept.map(p => p.url)).toEqual(['https://example.com/match']);
    });

    it('tolerates offers the scraper left without a title or district', () => {
        const bare = point('x', { title: null as unknown as string, location: null as unknown as MapPoint['location'] });

        expect(filterMapPoints([bare], { search: 'x' })).toEqual([]);
    });
});
