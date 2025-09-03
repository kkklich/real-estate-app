import { Component } from '@angular/core';
// import { Marker, latLng, tileLayer } from 'leaflet';
import { MatCard } from "@angular/material/card";
// import { LeafletModule } from '@asymmetrik/ngx-leaflet';

@Component({
  selector: 'app-map-view',
  imports: [MatCard],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss'
})
export class MapViewComponent {

  // options = {
  //   layers: [
  //     tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //       maxZoom: 18,
  //       attribution: 'OpenStreetMap'
  //     })
  //   ],
  //   zoom: 13,
  //   center: latLng(51.505, -0.09)
  // };

  // propertyMarkers: Marker[] = [];

  constructor() { }

  ngOnInit() {
    // this.realEstateService.getDashboardData().subscribe(data => {
    //   // Convert property locations to markers
    // });
  }
}
