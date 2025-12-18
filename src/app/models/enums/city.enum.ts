export enum cityEnum {
    Katowice = 'Katowice',
    Krakow = 'Krakow'
}

// ✅ City coordinates mapping
export const cityCoordinates: Record<cityEnum, [number, number]> = {
    [cityEnum.Katowice]: [19.039993, 50.227200],  // lng, lat
    [cityEnum.Krakow]: [19.944690, 50.064564],    // lng, lat
};

// ✅ Helper function for map centering
export function getCityCenter(city: cityEnum): [number, number] {
    return cityCoordinates[city];
}