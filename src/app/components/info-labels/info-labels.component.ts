import { Component, effect } from '@angular/core';
import { CalculateStatisticsService } from '../../services/calculate-statistics';

@Component({
    selector: 'app-info-labels',
    imports: [],
    templateUrl: './info-labels.component.html',
    styleUrls: ['./info-labels.component.scss']
})
export class InfoLabels {

    public averagePriceMeter: string = '';
    public averagePrice: string = '';

    constructor(private readonly calculateStatisticsService: CalculateStatisticsService) {
        effect(() => {
            this.averagePriceMeter = this.calculateStatisticsService.getInfoText();
            this.averagePrice = this.calculateStatisticsService.getPriceText();
        });
    }
}
