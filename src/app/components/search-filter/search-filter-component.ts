import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { cityEnum } from '../../models/enums/city.enum';

/**
 * Presentational only: it takes the current selection in and emits the next one out.
 *
 * It used to read the selection straight off CalculateStatisticsService and emit to
 * the dashboard, which then wrote back to that same singleton - a full circle for a
 * value the component already had.
 */
@Component({
    selector: 'app-search-filter',
    imports: [
        MatFormFieldModule,
        MatSelectModule
    ],
    templateUrl: './search-filter-component.html',
    styleUrl: './search-filter-component.scss'
})
export class SearchFilterComponent {

    readonly groupedBy = input.required<string>();
    readonly city = input.required<cityEnum>();
    readonly groupByTypes = input.required<readonly string[]>();

    readonly groupByTypeChange = output<string>();
    readonly cityChange = output<cityEnum>();

    readonly cityList = Object.values(cityEnum);
}
