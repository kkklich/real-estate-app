import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrapeService } from '../../services/scrape.service';

@Component({
    selector: 'app-scrape-button',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './scrape-button.component.html',
    styleUrl: './scrape-button.component.scss'
})
export class ScrapeButtonComponent {
    readonly scrapeService = inject(ScrapeService);
    readonly lastScrapedDisplay = computed(() => this.scrapeService.lastScraped() || '—');
}
