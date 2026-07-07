export interface SourceCount {
    source: string;
    count: number;
}

export interface DistrictPrice {
    district: string;
    medianPricePerMeter: number;
    count: number;
}

export interface BestDeal {
    title: string;
    url: string;
    district: string;
    price: number;
    area: number;
    floor: number;
    market: string;
    pricePerMeter: number;
    districtMedianPricePerMeter: number;
    belowMedianPercent: number;
    source: string;
}

export interface MarketInsights {
    totalOffers: number;
    medianPrice: number;
    medianPricePerMeter: number;
    minPricePerMeter: number;
    maxPricePerMeter: number;
    medianArea: number;
    privateOffersPercent: number;
    offersBySource: SourceCount[];
    districts: DistrictPrice[];
    bestDeals: BestDeal[];
}
