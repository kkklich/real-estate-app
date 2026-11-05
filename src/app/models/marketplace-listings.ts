export interface MarketplaceListingsResponse {
    city: string;
    source: string;
    savedToDatabase: false;
    fetchedAt: string;
    page: number;
    pageSize: number;
    isPartial: boolean;
    returnedCount: number;
    hasMore: boolean;
    nextPage: number | null;
    paginationLimitReached: boolean;
    pages: Array<{
        source: string;
        city: string;
        sourceUrl: string;
        totalCount: number | null;
        hasMore: boolean;
        returnedCount: number;
        error: { code: string; message: string; upstreamStatusCode: number | null } | null;
    }>;
    data: Array<{
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
        location: { lat: number; lon: number; city: string; district: string };
    }>;
}
