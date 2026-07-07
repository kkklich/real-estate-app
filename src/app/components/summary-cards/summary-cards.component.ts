import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DashboardSummary } from '../../models/dashboardCharts';

@Component({
    selector: 'app-summary-cards',
    imports: [DecimalPipe],
    templateUrl: './summary-cards.component.html',
    styleUrl: './summary-cards.component.scss'
})
export class SummaryCardsComponent {
    readonly summary = input<DashboardSummary | null>(null);
}
