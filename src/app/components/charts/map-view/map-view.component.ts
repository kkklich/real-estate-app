import { Component, OnDestroy, effect, signal, computed, untracked } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import * as GeoJSON from 'geojson';
import { getCityCenter } from '../../../models/enums/city.enum';
import { MapPoint } from '../../../models/mapPoint';

@Component({
    selector: 'app-map-view',
    imports: [],
    templateUrl: './map-view.component.html',
    styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements OnDestroy {

    private mapInstance?: maplibregl.Map;
    private mapInitialized = false;
    private readonly LIGHT_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=fE7HmfEfHzBPNM7hOEzA`;

    constructor(readonly calculateStatisticsService: CalculateStatisticsService) {
        this.setupMapEffect();
        this.setupViewportEffect();
    }

    // Preprocess data: compute colors once per groupedBy change, O(n).
    private readonly processedData = computed(() => {
        const points = this.calculateStatisticsService.mapPoints() ?? [];
        const groupedBy = this.calculateStatisticsService.groupedBy();

        if (points.length === 0) return [];

        return this.computePoints(points, groupedBy);
    });

    private computePoints(points: MapPoint[], groupedBy: string) {
        const values = points.map(p => this.calculateStatisticsService.getNested(p, groupedBy));

        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        const hasNumeric = numericValues.length > 0;

        let minVal = 0, maxVal = 1, range = 1;
        if (hasNumeric) {
            minVal = Math.min(...numericValues);
            maxVal = Math.max(...numericValues);
            range = maxVal - minVal || 1;
        }

        let stringMap = new Map<string, number>();
        if (!hasNumeric) {
            const unique = Array.from(new Set(values.map(v => String(v ?? ''))));
            const m = unique.length;
            if (m > 0) {
                unique.forEach((v, i) => stringMap.set(v, m === 1 ? 1 : i / (m - 1)));
            }
        }

        return points.map((p, i) => {
            const v = values[i];
            let ratio = 0.5;
            if (hasNumeric && typeof v === 'number') {
                ratio = (v - minVal) / range;
            } else {
                ratio = stringMap.get(String(v ?? '')) ?? 0.5;
            }
            ratio = Math.max(0, Math.min(1, ratio));
            const r = Math.round(255 * ratio);
            const b = Math.round(255 * (1 - ratio));
            const color = `rgb(${r},0,${b})`;

            return {
                lat: p.location!.lat,
                lng: p.location!.lon,
                label: p.title ?? 'Unknown',
                value: v,
                url: p.url ?? '',
                color
            };
        });
    }

    private setupMapEffect(): void {
        effect(() => {
            const data = this.processedData();

            if (data.length === 0) return;

            untracked(() => {
                if (!this.mapInitialized) {
                    this.initMap();
                } else {
                    this.updateMapData(data);
                }
            });
        });
    }

    // Tracks ONLY city - changing groupedBy must not reset the user's pan/zoom.
    private setupViewportEffect(): void {
        effect(() => {
            const city = this.calculateStatisticsService.city();

            untracked(() => {
                if (this.mapInitialized) {
                    const [lng, lat] = getCityCenter(city);
                    this.mapInstance?.setCenter([lng, lat]);
                    this.mapInstance?.setZoom(10);
                }
            });
        });
    }

    private initMap(): void {
        // Guard: data can arrive again while the style is still loading; creating a
        // second Map on the same container would leak a WebGL context.
        if (this.mapInstance) return;

        const [lng, lat] = getCityCenter(untracked(() => this.calculateStatisticsService.city()));
        this.mapInstance = new maplibregl.Map({
            container: 'map',
            style: this.LIGHT_STYLE,
            center: [lng, lat],
            zoom: 10
        });

        this.mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

        this.mapInstance.on('load', () => {
            this.mapInitialized = true;
            // read the signal fresh - the data captured when init started may be stale by now
            this.addMapLayers(untracked(() => this.processedData()));
        });
    }

    private addMapLayers(data: ReturnType<typeof this.processedData>): void {
        const geojson = this.buildGeoJson(data);

        this.mapInstance!.addSource('properties', {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        this.mapInstance!.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'properties',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
            }
        });

        this.mapInstance!.addLayer({
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

        this.mapInstance!.addLayer({
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

        this.mapInstance!.on('click', 'unclustered-point', (e) => {
            const feature = e.features![0];
            const props = feature.properties as any;

            // titles/urls come from scraped portals - escape them, they are untrusted HTML
            const label = this.escapeHtml(String(props.label ?? ''));
            const url = String(props.url ?? '');
            const safeUrl = /^https?:\/\//i.test(url) ? this.escapeHtml(url) : '';
            const value = this.escapeHtml(String(props.value ?? ''));

            const urlHtml = safeUrl ? `<br><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>` : '';
            const htmlContent = `<strong>${label}</strong><br>${this.calculateStatisticsService.groupedBy()}: ${value}${urlHtml}`;

            new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(htmlContent)
                .addTo(this.mapInstance!);
        });

        this.fitBounds(data);
    }

    private updateMapData(data: ReturnType<typeof this.processedData>): void {
        const source = this.mapInstance?.getSource('properties') as maplibregl.GeoJSONSource;
        if (source) {
            source.setData(this.buildGeoJson(data));
        }
    }

    private buildGeoJson(data: ReturnType<typeof this.processedData>): GeoJSON.FeatureCollection {
        return {
            type: 'FeatureCollection',
            features: data.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: {
                    label: p.label,
                    value: p.value,
                    color: p.color,
                    url: p.url
                }
            }))
        };
    }

    private fitBounds(data: ReturnType<typeof this.processedData>): void {
        const bounds = new maplibregl.LngLatBounds();
        data.forEach(p => bounds.extend([p.lng, p.lat]));
        this.mapInstance?.fitBounds(bounds, { padding: 50 });
    }

    private escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    ngOnDestroy(): void {
        this.mapInstance?.remove();
        this.mapInstance = undefined;
        this.mapInitialized = false;
    }
}
