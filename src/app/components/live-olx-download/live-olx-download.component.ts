import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { cityEnum } from '../../models/enums/city.enum';
import { LiveOlxDownloadService } from '../../services/live-olx-download.service';

@Component({
    selector: 'app-live-olx-download',
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
    providers: [LiveOlxDownloadService],
    templateUrl: './live-olx-download.component.html',
    styleUrl: './live-olx-download.component.scss'
})
export class LiveOlxDownloadComponent {
    readonly city = input.required<cityEnum>();
    readonly download = inject(LiveOlxDownloadService);
}
