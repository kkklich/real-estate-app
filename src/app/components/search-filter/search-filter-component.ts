import { Component, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
    imports: [MatButtonToggleModule],
    templateUrl: './search-filter-component.html',
    styleUrl: './search-filter-component.scss'
})
export class SearchFilterComponent {

    readonly city = input.required<cityEnum>();

    readonly cityChange = output<cityEnum>();

    // The enum values are what the API expects; the labels are what people read.
    readonly cities: readonly { value: cityEnum; label: string }[] = [
        { value: cityEnum.Katowice, label: 'Katowice' },
        { value: cityEnum.Krakow, label: 'Kraków' }
    ];
}
