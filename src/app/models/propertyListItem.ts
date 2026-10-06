export interface PropertyListItem {
    id: string;
    url: string;
    title: string;
    price: number;
    pricePerMeter: number;
    floor: number;
    market: string;
    buildingType: string;
    area: number;
    private: boolean;
    webName: number;
    city: string;
    district: string;
    firstSeen: string;
    lastSeen: string;
    snapshotCount: number;
    firstPrice: number;
    /** Price now minus the first price; null when either is 0, a price the portal did not state. */
    priceChange: number | null;
}
