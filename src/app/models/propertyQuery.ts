export interface PropertyQuery {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    city?: string;
    district?: string;
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
    search?: string;
}
