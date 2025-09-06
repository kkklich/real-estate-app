import { AfterViewInit, Component, effect, signal, Signal, untracked } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CalculateStatisticsService } from '../../../services/calculate-statistics';
import { Observable } from 'rxjs';
import { PropertydataAPI } from '../../../models/property';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements AfterViewInit {

  data$!: Signal<PropertydataAPI>;

  private readonly viewReady = signal(false);

  private points: Array<{ lat: number, lng: number, label: string, value: number }> = [];

  constructor(readonly calculateStatisticsService: CalculateStatisticsService) {
    this.data$ = this.calculateStatisticsService.getData();

  }


  private readonly pointsEffect = effect(() => {
    const data = this.data$();            // read the signal
    const items = data?.data ?? [];

    const groupedBy = this.calculateStatisticsService.groupedBy(); // call if it's a signal/method
    this.points = items
      .map(item => {
        const value = this.calculateStatisticsService.getNested(item, groupedBy);
        return {
          lat: item.location.lat,
          lng: item.location.lon,
          label: item.title ?? 'Unknown',
          value: value
        };
      })
      .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number'); // keep valid 0 coords

    if (this.viewReady() && this.points.length) {
      untracked(() => this.generatemap()); // avoid tracking imperative work
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
      center: [this.points[0].lng, this.points[0].lat], // starting position [lng, lat]
      zoom: 10
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.points.forEach(p => {
      const color = this.getColorGradient(p.value); // decide color

      new maplibregl.Marker({ color })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup().setText(`${p.label}  \n(value: ${p.value})`))
        .addTo(map);
    });

    // 🔹 Fit map to all points
    const bounds = new maplibregl.LngLatBounds();
    this.points.forEach(p => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 50 });
  }

  private getColorGradient(value: any): string {
    let clamped = 1;
    if (typeof value === 'number' && !isNaN(value)) {

      const minValue = Math.min(...this.points.map(p => p.value));
      const maxValue = Math.max(...this.points.map(p => p.value));
      const ratio = ((value - minValue) / (maxValue - minValue)) //* 1000;
      // console.log(ratio);
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
