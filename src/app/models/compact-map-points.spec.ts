import { CompactMapPoints, decodeMapPoints } from './compact-map-points';

describe('compact map transport', () => {
    it('preserves every field including Polish text, zeros and decimal precision', () => {
        const data: CompactMapPoints = {
            version: 1, markets: ['Wtórny'], buildingTypes: ['Blok'], districts: ['Łagiewniki'],
            points: [['https://example.com/a?x=1&y=2', 'Mieszkanie „Łąka”', 645795.5, 12915.91,
                0, 0, 0, 50.001, false, 50.03123456789, 19.9123456789, 0]]
        };
        expect(decodeMapPoints(data)).toEqual([{
            url: 'https://example.com/a?x=1&y=2', title: 'Mieszkanie „Łąka”',
            price: 645795.5, pricePerMeter: 12915.91, floor: 0, market: 'Wtórny', buildingType: 'Blok',
            area: 50.001, private: false,
            location: { lat: 50.03123456789, lon: 19.9123456789, district: 'Łagiewniki' }
        }]);
    });

    it('reads an empty compact batch and rejects an unknown version', () => {
        expect(decodeMapPoints({ version: 1, markets: [], buildingTypes: [], districts: [], points: [] })).toEqual([]);
        expect(() => decodeMapPoints({ version: 2 } as unknown as CompactMapPoints)).toThrow();
    });
});
