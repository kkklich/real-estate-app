import { FormsModule } from '@angular/forms';
import { Component, Output, EventEmitter } from '@angular/core';
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

  @Output() groupByTypeChange = new EventEmitter<string | null>();

  protected groupByTypes: string[] = [
    'floor',
    'market',
    'buildingType',
    'area',
    'private',
    'location.district'
  ];

  selectedType: string | null = null;

  public onGroupByTypeChange(value: string | null) {
    console.log('Group by type changed:', value);
    this.groupByTypeChange.emit(value);
  }

  constructor() { }
}
