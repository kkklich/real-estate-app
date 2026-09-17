import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalculateStatisticsService } from '../../services/calculate-statistics';
import { portalName } from '../../models/enums/web-name.enum';

@Component({
    selector: 'app-price-drops',
    imports: [
        DecimalPipe,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './price-drops.component.html',
    styleUrl: './price-drops.component.scss'
})
export class PriceDropsComponent {

    protected readonly stats = inject(CalculateStatisticsService);

    protected readonly drops = this.stats.priceDrops.data;
    protected readonly loading = this.stats.priceDrops.loading;
    protected readonly error = this.stats.priceDrops.error;

    protected readonly portalName = portalName;
}
