export interface PropertyQuery {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    city?: string;
    /** Substring of the district, like `search` but on that column alone. */
    district?: string;
    /** Substring of the title, like `search` but on that column alone. */
    title?: string;
    market?: string;
    buildingType?: string;
    webName?: number;
    private?: boolean;
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
    pricePerMeterMin?: number;
    pricePerMeterMax?: number;
    floorMin?: number;
    floorMax?: number;
    /** Bounds on the price move since the offer was first seen; negative is a markdown. */
    priceChangeMin?: number;
    priceChangeMax?: number;
    snapshotCountMin?: number;
    snapshotCountMax?: number;
    /** Substring of the title or the district. */
    search?: string;
}
