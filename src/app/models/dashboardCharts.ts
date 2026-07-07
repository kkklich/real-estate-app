import { DistrictPrice } from './marketInsights';

export interface DashboardSummary {
    totalOffers: number;
    medianPrice: number;
    medianPricePerMeter: number;
    medianArea: number;
    privateOffersPercent: number;
    lastUpdated: string;
}

export interface TimelinePoint {
    date: string;
    avgPricePerMeter: number;
    avgPrice: number;
    count: number;
}

export interface HistogramBin {
    label: string;
    count: number;
}

export interface SplitSlice {
    name: string;
    count: number;
    medianPricePerMeter: number;
}

export interface DashboardCharts {
    summary: DashboardSummary;
    timeline: TimelinePoint[];
    pricePerMeterHistogram: HistogramBin[];
    districtPrices: DistrictPrice[];
    marketSplit: SplitSlice[];
    buildingTypeSplit: SplitSlice[];
}
