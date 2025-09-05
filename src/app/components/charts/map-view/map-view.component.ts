import { AfterViewInit, Component } from '@angular/core';
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

  //todo please refactor this code that values from data$ will be used to generate points on the map
  data$!: Observable<PropertydataAPI>;
  private minValue = 0;
  private maxValue = 100;

  private points: Array<{ lat: number, lng: number, label: string, value: number }> = [];

  constructor(readonly calculateStatisticsService: CalculateStatisticsService) {
    this.data$ = this.calculateStatisticsService.getData();

  }

  ngAfterViewInit(): void {
    this.data$.subscribe(data => {
      this.points = (data.data || []).map(item => {
        const groupedBy = this.calculateStatisticsService.groupedBy;
        const value = this.calculateStatisticsService.getNested(item, groupedBy);
        console.log('Item:', item, 'GroupedBy:', groupedBy, 'Value:', value);
        return {
          lat: item.location.lat,
          lng: item.location.lon,
          label: item.title ?? 'Unknown',
          value: value !== null && value !== undefined ? Number(value) : 0
        };
      }).filter(p => p.lat && p.lng);
      if (this.points.length) {
        this.generatemap();
      }
    });
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

    //todo check if  p.value is number

    this.points.forEach(p => {
      const color = this.getColorGradient(p.value); // decide color

      new maplibregl.Marker({ color })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup().setText(`${p.label}  \n(value: ${p.value})`))
        .addTo(map);
    });


    console.log('sssss', this.points);
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
      console.log(ratio);
      clamped = Math.max(0, Math.min(1, ratio)); // keep between 0 and 1
    }

    const r = Math.round(255 * clamped);            // red increases with value
    const g = 0;                                    // no green for simplicity
    const b = Math.round(255 * (1 - clamped));      // blue decreases with value

    return `rgb(${r},${g},${b})`;
  }
}
