export interface PropertyHistoryEntry {
    date: string;
    price: number;
    pricePerMeter: number;
    webName: number;
    url: string;
    priceChange: number;
}

export interface PropertyHistory {
    id: string;
    url: string;
    title: string;
    city: string;
    district: string;
    area: number;

    // Newest-snapshot detail.
    price: number;
    pricePerMeter: number;
    floor: number;
    market: string;
    buildingType: string;
    private: boolean;
    webName: number;
    lat: number;
    lon: number;
    offertId: string;
    description: string;
    createdTime: string;

    // History aggregates over every matched snapshot.
    firstSeen: string;
    lastSeen: string;
    snapshotCount: number;
    firstPrice: number;
    totalPriceChange: number;

    entries: PropertyHistoryEntry[];
}
