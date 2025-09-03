export interface Property {
    id: number;
    url: string;
    title: string;
    createdTime: string;
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
        city: string;
        district: string;
    };
    photos: any[];
}

export interface PropertydataAPI {
    totalCount: number;
    data: Property[];
}
