export interface BarChartDataset {
    data: number[];
    label: string;
}

export interface BarChartData {
    labels: string[];
    datasets: BarChartDataset[];
}
