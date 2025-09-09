type GroupData = {
    averageFloor: number;
    count: number;
    medianArea: number;
    medianPrice: number;
    medianPricePerMeter: number;
};

type InputEntry = {
    [group: string]: GroupData;
};

type GroupedChartSeries = {
    name: string;
    data: number[];
};

type GroupedChartData = {
    categories: (keyof GroupData)[];
    series: GroupedChartSeries[];
};
