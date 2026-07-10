import { DashboardCharts } from './dashboardCharts';
import { MarketInsights } from './marketInsights';
import { MapPoint } from './mapPoint';

export interface FullDashboard {
    charts: DashboardCharts;
    insights: MarketInsights;
    mapPoints: MapPoint[];
}
