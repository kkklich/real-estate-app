import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-search-filter',

  imports: [
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
  FormsModule
  ],
  templateUrl: './search-filter-component.html',
  styleUrl: './search-filter-component.scss'
})
export class SearchFilterComponent {
  searchText = '';
  district = '';
  propertyType = '';
  priceRange = '';

  constructor() { }
}
