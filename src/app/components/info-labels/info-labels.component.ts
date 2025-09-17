import { ChangeDetectorRef, Component, effect } from '@angular/core';
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

    constructor(readonly calculateStatisticsService: CalculateStatisticsService, readonly cdr: ChangeDetectorRef) {
        effect(() => {
            void this.calculateStatisticsService.data();
            this.averagePriceMeter = calculateStatisticsService.getInfoText();
            this.averagePrice = calculateStatisticsService.getPriceText();
            cdr.detectChanges();
        });
    }
}
