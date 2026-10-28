import { filterMapPoints } from './map-point-filter';
import { MapPoint } from '../../../models/mapPoint';

describe('filterMapPoints', () => {

    const point = (title: string, overrides: Partial<MapPoint> = {}): MapPoint => ({
        url: `https://example.com/${title}`, title, price: 500_000, pricePerMeter: 10_000, floor: 1,
        market: 'Wtórny', buildingType: 'blok', area: 50, private: false,
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

    it('combines building type with either seller choice', () => {
        const points = [
            point('owner', { buildingType: 'Blok', private: true }),
            point('agency', { buildingType: 'blok', private: false }),
            point('other building', { buildingType: 'kamienica', private: false })
        ];
        expect(titles(filterMapPoints(points, { buildingType: ' BLOK ', private: false }))).toEqual(['agency']);
        expect(titles(filterMapPoints(points, { buildingType: 'blok', private: true }))).toEqual(['owner']);
        expect(titles(filterMapPoints(points, { private: false }))).toEqual(['agency', 'other building']);
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

    // A cleared number input is null in the form, but 0 is a real bound: it is applied, not
    // read as "no bound". Floor 0 is the ground floor, a value like any other.
    it('applies a zero bound', () => {
        const points = [point('unpriced', { price: 0 }), point('priced', { price: 1 })];

        expect(titles(filterMapPoints(points, { priceMin: 0 }))).toEqual(['priced']);
        expect(titles(filterMapPoints(points, { priceMax: 0 }))).toEqual([]);

        const floors = [point('ground', { floor: 0 }), point('first', { floor: 1 })];
        expect(titles(filterMapPoints(floors, { floorMax: 0 }))).toEqual(['ground']);
    });

    // A 0 price, area or price per m² is one the portal did not state. As in the API, it
    // matches no bound on that column - read as a real 0 it passed every maximum - yet the
    // offer stays on the map while that column is not filtered.
    it('keeps offers with an unstated price, area or price per m² out of the bounds on it', () => {
        const points = [
            point('stated', { price: 400_000, area: 40, pricePerMeter: 10_000 }),
            point('no price', { price: 0, pricePerMeter: 0 }),
            point('no area', { area: 0 })
        ];

        expect(titles(filterMapPoints(points, { priceMax: 500_000 }))).toEqual(['stated', 'no area']);
        expect(titles(filterMapPoints(points, { pricePerMeterMax: 12_000 }))).toEqual(['stated', 'no area']);
        expect(titles(filterMapPoints(points, { areaMax: 60 }))).toEqual(['stated', 'no price']);
        expect(titles(filterMapPoints(points, {}))).toEqual(['stated', 'no price', 'no area']);
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

    it('treats the price-per-meter and floor bounds as inclusive too', () => {
        const points = [
            point('ground', { pricePerMeter: 8_000, floor: 0 }),
            point('middle', { pricePerMeter: 12_000, floor: 3 }),
            point('top', { pricePerMeter: 18_000, floor: 9 })
        ];

        expect(titles(filterMapPoints(points, { pricePerMeterMin: 12_000 }))).toEqual(['middle', 'top']);
        expect(titles(filterMapPoints(points, { pricePerMeterMax: 12_000 }))).toEqual(['ground', 'middle']);
        expect(titles(filterMapPoints(points, { floorMin: 0, floorMax: 3 }))).toEqual(['ground', 'middle']);
    });

    // The column filters narrow one column each, where `search` spans both.
    it('matches the title and district columns separately', () => {
        const points = [
            point('Kawalerka Podgórze', { location: { lat: 50, lon: 19, district: 'Podgórze' } }),
            point('Kawalerka', { location: { lat: 50, lon: 19, district: 'Nowa Huta' } })
        ];

        expect(titles(filterMapPoints(points, { title: 'kawalerka' }))).toEqual(['Kawalerka Podgórze', 'Kawalerka']);
        expect(titles(filterMapPoints(points, { district: 'podgorze' }))).toEqual(['Kawalerka Podgórze']);
        // The same word in the other column no longer matches, which is what `search` did.
        expect(titles(filterMapPoints(points, { title: 'podgorze', district: 'nowa huta' }))).toEqual([]);
    });

    // The table's API drops trailing spaces from a substring filter and keeps leading ones;
    // the map has to agree, or "krak " lists offers in the table that the map leaves out.
    it('drops trailing spaces from a text filter, as the table does, but keeps leading ones', () => {
        const points = [
            point('Kraków Nowa Huta', { location: { lat: 50, lon: 19, district: 'Nowa Huta' } }),
            point('Krakowska', { location: { lat: 50, lon: 19, district: 'Podgórze' } })
        ];

        expect(titles(filterMapPoints(points, { search: 'krak ' }))).toEqual(['Kraków Nowa Huta', 'Krakowska']);
        expect(titles(filterMapPoints(points, { title: 'krakow  ' }))).toEqual(['Kraków Nowa Huta', 'Krakowska']);
        expect(titles(filterMapPoints(points, { district: 'huta ' }))).toEqual(['Kraków Nowa Huta']);
        expect(titles(filterMapPoints(points, { search: ' huta' }))).toEqual(['Kraków Nowa Huta']);
        expect(titles(filterMapPoints(points, { search: ' krak' }))).withContext('leading space kept').toEqual([]);
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
