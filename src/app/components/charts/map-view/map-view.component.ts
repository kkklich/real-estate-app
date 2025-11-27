import { AfterViewInit, Component, effect, signal, Signal, untracked } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import { PropertydataAPI } from '../../../models/property';
import * as GeoJSON from 'geojson';

@Component({
    selector: 'app-map-view',
    imports: [],
    templateUrl: './map-view.component.html',
    styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements AfterViewInit {

    data$!: Signal<PropertydataAPI>;

    private readonly viewReady = signal(false);
    private points: Array<{ lat: number, lng: number, label: string, value: number, url: string }> = [];

    constructor(readonly calculateStatisticsService: CalculateStatisticsService) {
        this.data$ = this.calculateStatisticsService.getData();
    }

    private readonly resetOnGroupChange = effect(() => {
        const groupedBy = this.calculateStatisticsService.groupedBy(); // tracked
        this.points = []; // clear immediately when groupedBy changes
    });

    private readonly pointsEffect = effect(() => {
        const groupedBy = this.calculateStatisticsService.groupedBy();
        if (!this.viewReady() || this.points.length > 0)
            return;
        const data = this.data$();// read the signal
        const items = data?.data ?? [];

        // call if it's a signal/method
        this.points = items
            .map(item => {
                const value = this.calculateStatisticsService.getNested(item, groupedBy);
                const lat = item?.location?.lat;
                const lng = item?.location?.lon;

                return {
                    lat,
                    lng,
                    label: item?.title ?? 'Unknown',
                    value,
                    url: item?.url ?? ''
                }
            })
            .filter(p =>
                typeof p.lat === 'number' &&
                typeof p.lng === 'number' &&
                p.lat !== 0 &&
                p.lng !== 0
            )
            .map(p => ({
                // Narrow to numbers after filter
                lat: p.lat as number,
                lng: p.lng as number,
                label: p.label,
                value: p.value,
                url: p.url
            }));

        if (this.viewReady() && this.points.length) {
            untracked(() => this.generatemap());
        }
    });

    ngAfterViewInit(): void {
        this.viewReady.set(true);
    }

    private generatemap(): void {
        if (!this.points.length) return;

        const map = new maplibregl.Map({
            container: 'map',
            style: `https://api.maptiler.com/maps/hybrid/style.json?key=fE7HmfEfHzBPNM7hOEzA`,
            center: [this.points[0].lng, this.points[0].lat],
            zoom: 10
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
            // Convert points to GeoJSON
            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: this.points.map(p => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                    properties: {
                        label: p.label,
                        value: p.value,
                        color: this.getColorGradient(p.value),
                        url: p.url
                    }
                }))
            };

            // Add source and layers INSIDE 'load' event
            map.addSource('properties', {
                type: 'geojson',
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });

            // All your layers and event handlers go here (clusters, cluster-count, unclustered-point)
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'properties',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step', ['get', 'point_count'],
                        '#51bbd6', 100, '#f1f075', 750, '#f28cb1'
                    ],
                    'circle-radius': [
                        'step', ['get', 'point_count'],
                        20, 100, 30, 750, 40
                    ]
                }
            });

            // Add cluster count labels
            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'properties',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12
                }
            });

            // Add non-clustered point layer (individual markers)
            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'properties',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': ['get', 'color'],
                    'circle-radius': 8,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            });

            map.on('click', 'unclustered-point', (e) => {
                const feature = e.features![0];
                const props = feature.properties as any;

                const urlHtml = props.url ? `<br><a href="${props.url}" target="_blank" rel="noopener noreferrer">${props.url}</a>` : '';

                const htmlContent = `<strong>${props.label}</strong><br>
                         ${this.calculateStatisticsService.groupedBy().toString()}: ${props.value}
                                ${urlHtml}
                                    `;

                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(htmlContent)
                    .addTo(map);
            });

            // Fit bounds after layers render
            const bounds = new maplibregl.LngLatBounds();
            this.points.forEach(p => bounds.extend([p.lng, p.lat]));
            map.fitBounds(bounds, { padding: 50 });
        });
    }

    private getColorGradient(value: any): string {
        let clamped = 1;
        if (typeof value === 'number' && !isNaN(value)) {

            const minValue = Math.min(...this.points.map(p => p.value));
            const maxValue = Math.max(...this.points.map(p => p.value));
            const ratio = ((value - minValue) / (maxValue - minValue));

            clamped = Math.max(0, Math.min(1, ratio)); // keep between 0 and 1
        } else {
            const ratioString = this.scoreTags01(this.points.map(p => p.value.toString()));
            clamped = ratioString.get(value.toString()) ?? 0;
        }

        const r = Math.round(255 * clamped);            // red increases with value
        const g = 0;                                    // no green for simplicity
        const b = Math.round(255 * (1 - clamped));      // blue decreases with value

        return `rgb(${r},${g},${b})`;
    }

    scoreTags01(tags: Iterable<string>, options?: { scorer?: (tag: string) => number }): Map<string, number> {
        const arr = Array.from(new Set(tags)); // ensure uniqueness [1]
        const m = arr.length;

        // No tags -> empty map
        if (m === 0) return new Map();

        if (options?.scorer) {
            // Use custom scorer then min-max normalize to [0,1] [7]
            const raw = arr.map(t => ({ t, s: options.scorer!(t) }));
            const sMin = Math.min(...raw.map(r => r.s));
            const sMax = Math.max(...raw.map(r => r.s));
            const denom = sMax - sMin;
            const norm = new Map<string, number>();
            for (const { t, s } of raw) {
                const v = denom === 0 ? 1 : (s - sMin) / denom; // if all equal, map to 1 [7]
                norm.set(t, v);
            }
            return norm;
        }

        // Even spacing across [0,1] using rank
        // Single element => 1. For >1, first=0, last=1, linear spacing. [15]
        if (m === 1) {
            return new Map([[arr[0], 1]]);
        }
        const map = new Map<string, number>();
        for (let i = 0; i < m; i++) {
            const v = i / (m - 1); // 0 ... 1 inclusive [15]
            map.set(arr[i], v);
        }
        return map;
    }
}
