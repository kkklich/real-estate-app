import { MapPoint } from './mapPoint';

export type CompactMapPointRow = [string, string, number, number, number, number,
    number, number, boolean, number, number, number];

export interface CompactMapPoints {
    version: 1;
    markets: string[];
    buildingTypes: string[];
    districts: string[];
    points: CompactMapPointRow[];
}

/** Old servers ignore compact=true and still return the original array. */
export function decodeMapPoints(payload: CompactMapPoints | MapPoint[] | null): MapPoint[] {
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.version !== 1) throw new Error('Unsupported map data version');
    return payload.points.map(row => ({
        url: row[0], title: row[1], price: row[2], pricePerMeter: row[3], floor: row[4],
        market: payload.markets[row[5]], buildingType: payload.buildingTypes[row[6]],
        area: row[7], private: row[8],
        location: { lat: row[9], lon: row[10], district: payload.districts[row[11]] }
    }));
}
