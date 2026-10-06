// Slim per-offer shape the map consumes. Mirrors the API's MapPointDTO -
// only coordinates, the popup fields and the group-by fields, nothing heavy. No colour:
// the map colours each dot by the field it groups by (map-view's scales), so the API
// stopped sending one.
export interface MapPoint {
    url: string;
    title: string;
    price: number;
    pricePerMeter: number;
    floor: number;
    market: string;
    buildingType: string;
    area: number;
    private: boolean;
    location: {
        lat: number;
        lon: number;
        district: string;
    };
}
