import { AfterViewInit, Component } from '@angular/core';
import * as maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements AfterViewInit {

  private readonly minValue = 0;
  private readonly maxValue = 100;

  private readonly points = [
    { lat: 50.02166, lng: 19.88934, label: 'Krk', value: 11 },
    { lat: 49.88071836, lng: 19.81419609, label: 'Los Angeles', value: 46 },
    { lat: 50.0113682, lng: 19.9085036, label: 'San Francisco', value: 100 }
  ];

  constructor() { }

  ngAfterViewInit(): void {
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

  private getColorGradient(value: number): string {
    const ratio = (value - this.minValue) / (this.maxValue - this.minValue);
    const clamped = Math.max(0, Math.min(1, ratio)); // keep between 0 and 1

    const r = Math.round(255 * clamped);            // red increases with value
    const g = 0;                                    // no green for simplicity
    const b = Math.round(255 * (1 - clamped));      // blue decreases with value

    return `rgb(${r},${g},${b})`;
  }
}
