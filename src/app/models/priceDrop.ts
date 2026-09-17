// One offer whose price fell from the previous scrape to the newest one.
// Mirrors PriceDropDTO on the API (getPriceDrops/{city}).
export interface PriceDrop {
    url: string;
    title: string;
    city: string;
    district: string;
    area: number;
    webName: number;
    currentPrice: number;
    previousPrice: number;
    currentPricePerMeter: number;
    previousSeen: string;
    lastSeen: string;
    dropAmount: number;
    dropPercent: number;
}
