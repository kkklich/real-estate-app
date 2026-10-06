export interface PropertyHistoryEntry {
    date: string;
    /** 0 when the portal did not state a price in this snapshot. */
    price: number;
    pricePerMeter: number;
    webName: number;
    /**
     * The link this snapshot was scraped from. It is not always the offer's own: the
     * history also takes in re-posts of the flat under a new link, and the same flat on
     * another portal.
     */
    url: string;
    /**
     * The move since the last earlier snapshot that stated a price; 0 for the first entry.
     * Null when this snapshot's price is 0 (not stated) or no earlier one stated a price.
     */
    priceChange: number | null;
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
    /** The oldest price that was stated (non-zero); 0 when no snapshot stated one. */
    firstPrice: number;
    /** The current price minus firstPrice; null when either was not stated. */
    totalPriceChange: number | null;

    entries: PropertyHistoryEntry[];
}
