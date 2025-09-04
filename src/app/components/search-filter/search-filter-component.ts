import { FormsModule } from '@angular/forms';
import { Component, Output, EventEmitter } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CalculateStatisticsService } from '../../services/calculate-statistics';

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

  @Output() groupByTypeChange = new EventEmitter<string | null>();

  constructor(readonly calculateStatisticsService: CalculateStatisticsService) { }

  public onGroupByTypeChange(value: string | null) {
    this.groupByTypeChange.emit(value);
  }
}
