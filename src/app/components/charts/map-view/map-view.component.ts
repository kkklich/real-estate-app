import { AfterViewInit, Component, effect, signal, computed, untracked } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import * as GeoJSON from 'geojson';
import { getCityCenter } from '../../../models/enums/city.enum';

@Component({
    selector: 'app-map-view',
    imports: [],
    templateUrl: './map-view.component.html',
    styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements AfterViewInit {

    private mapInstance?: maplibregl.Map;

    private readonly viewReady = signal(false);
    private mapPoints: Array<{ lat: number, lng: number, label: string, value: number, url: string }> = [];

    constructor(readonly calculateStatisticsService: CalculateStatisticsService) { }

    ngAfterViewInit(): void {
        this.viewReady.set(true);
    }

    // ✅ Reactive map data derived from service signals
    private readonly mapData = computed(() => {
        const data = this.calculateStatisticsService.getData();
        const groupedBy = this.calculateStatisticsService.groupedBy();
        const items = data()?.data ?? [];

        return items
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
                lat: p.lat as number,
                lng: p.lng as number,
                label: p.label,
                value: p.value,
                url: p.url
            }));
    });

    // ✅ Single effect that reacts to ALL dependencies + waits for data
    private readonly mapEffect = effect(() => {
        // Track all reactive dependencies
        this.calculateStatisticsService.city();
        this.calculateStatisticsService.groupedBy();
        this.mapData(); // This tracks data$ internally

        // Early exit conditions
        if (!this.viewReady() || this.mapData().length === 0) {
            this.mapPoints = [];
            return;
        }

        // ✅ Data is guaranteed to be loaded here - computed only runs when data$ has value
        this.mapPoints = this.mapData();

        // Generate map outside tracking context
        if (this.viewReady()) {
            untracked(() => this.generatemap());
        }
    }, { allowSignalWrites: true });

    private readonly cityChange = effect(() => {
        const city = this.calculateStatisticsService.city(); // tracked
        this.mapPoints = []; // clear immediately when groupedBy changes

        const [lng, lat] = getCityCenter(city);
        if (this.mapInstance) {
            this.mapInstance.setCenter([lng, lat]);
            this.mapInstance.setZoom(10);
        }
    });

    private generatemap(): void {
        if (!this.mapPoints.length) return;
        this.mapInstance = undefined;
        const [lng, lat] = getCityCenter(this.calculateStatisticsService.city());
        this.mapInstance = new maplibregl.Map({
            container: 'map',
            style: `https://api.maptiler.com/maps/hybrid/style.json?key=fE7HmfEfHzBPNM7hOEzA`,
            center: [lng, lat],
            zoom: 10
        });

        this.mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

        this.mapInstance.on('load', () => {
            const geojson: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: this.mapPoints.map(p => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                    properties: {
                        label: p.label,
                        value: p.value,
                        color: this.getColorGradient(p),
                        url: p.url
                    }
                }))
            };

            this.mapInstance?.addSource('properties', {
                type: 'geojson',
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });

            this.mapInstance?.addLayer({
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

            this.mapInstance?.addLayer({
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

            this.mapInstance?.addLayer({
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

            this.mapInstance?.on('click', 'unclustered-point', (e) => {
                const feature = e.features![0];
                const props = feature.properties as any;

                const urlHtml = props.url ? `<br><a href="${props.url}" target="_blank" rel="noopener noreferrer">${props.url}</a>` : '';

                const htmlContent = `<strong>${props.label}</strong><br>
                         ${this.calculateStatisticsService.groupedBy().toString()}: ${props.value}
                                ${urlHtml}`;

                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(htmlContent)
                    .addTo(this.mapInstance!);
            });

            const bounds = new maplibregl.LngLatBounds();
            this.mapPoints.forEach(p => bounds.extend([p.lng, p.lat]));
            this.mapInstance?.fitBounds(bounds, { padding: 50 });
        });
    }

    private getColorGradient(point: { value: any, }): string {
        let clamped = 1;
        if (typeof point.value === 'number' && !isNaN(point.value)) {
            const minValue = Math.min(...this.mapPoints.map(p => p.value));
            const maxValue = Math.max(...this.mapPoints.map(p => p.value));
            const ratio = ((point.value - minValue) / (maxValue - minValue));
            clamped = Math.max(0, Math.min(1, ratio));
        } else {
            const ratioString = this.scoreTags01(this.mapPoints.map(p => p.value.toString()));
            clamped = ratioString.get(point.value.toString()) ?? 0;
        }

        const r = Math.round(255 * clamped);
        const g = 0;
        const b = Math.round(255 * (1 - clamped));

        return `rgb(${r},${g},${b})`;
    }

    scoreTags01(tags: Iterable<string>): Map<string, number> {
        const arr = Array.from(new Set(tags));
        const m = arr.length;

        if (m === 0) return new Map();
        if (m === 1) return new Map([[arr[0], 1]]);

        const map = new Map<string, number>();
        for (let i = 0; i < m; i++) {
            const v = i / (m - 1);
            map.set(arr[i], v);
        }
        return map;
    }
}
