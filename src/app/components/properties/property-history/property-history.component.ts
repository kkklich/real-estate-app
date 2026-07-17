import { Component, computed, signal } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { PropertyListService } from '../../../services/property-list.service';
import { PropertyHistory } from '../../../models/propertyHistory';

@Component({
    selector: 'app-property-history',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        BaseChartDirective
    ],
    templateUrl: './property-history.component.html',
    styleUrl: './property-history.component.scss'
})
export class PropertyHistoryComponent {

    readonly history = signal<PropertyHistory | null>(null);
    readonly loading = signal<boolean>(false);
    readonly error = signal<string | null>(null);

    // WebName enum on the backend: 0 = OLX, 1 = Morizon, 2 = NieruchomosciOnline.
    private readonly portalNames: Record<number, string> = {
        0: 'OLX',
        1: 'Morizon',
        2: 'Nieruchomości-online'
    };

    protected portalName(webName: number): string {
        return this.portalNames[webName] ?? `#${webName}`;
    }

    protected ownerLabel(isPrivate: boolean): string {
        return isPrivate ? 'Prywatny' : 'Biuro / deweloper';
    }

    protected readonly chartData = computed<ChartData>(() => {
        const entries = this.history()?.entries ?? [];
        return {
            labels: entries.map(e => formatDate(e.date, 'dd.MM.yyyy HH:mm', 'pl')),
            datasets: [
                {
                    type: 'line' as const,
                    label: 'Price (PLN)',
                    data: entries.map(e => e.price),
                    yAxisID: 'y',
                    borderColor: '#234392',
                    backgroundColor: 'rgba(35, 67, 146, 0.08)',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: true
                },
                {
                    type: 'line' as const,
                    label: 'Price / m² (PLN)',
                    data: entries.map(e => e.pricePerMeter),
                    yAxisID: 'y1',
                    borderColor: '#e08a1e',
                    backgroundColor: 'rgba(224, 138, 30, 0.06)',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    fill: false
                }
            ]
        };
    });

    protected readonly chartOptions: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { color: '#6d748a', usePointStyle: true } },
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('pl-PL')}`
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#6d748a', maxTicksLimit: 12 }
            },
            y: {
                position: 'left',
                grid: { color: '#e9ecf6' },
                ticks: { color: '#234392', callback: (value) => Number(value).toLocaleString('pl-PL') },
                title: { display: true, text: 'PLN', color: '#6d748a' }
            },
            y1: {
                position: 'right',
                grid: { display: false },
                ticks: { color: '#e08a1e', callback: (value) => Number(value).toLocaleString('pl-PL') },
                title: { display: true, text: 'PLN / m²', color: '#6d748a' }
            }
        }
    };

    constructor(
        private readonly route: ActivatedRoute,
        private readonly propertyListService: PropertyListService
    ) {
        this.route.queryParams.subscribe(params => {
            const city = params['city'];
            const url = params['url'];
            if (city && url) {
                this.load(city, url);
            } else {
                this.error.set('Missing city or url parameter.');
            }
        });
    }

    private load(city: string, url: string): void {
        this.loading.set(true);
        this.error.set(null);
        this.propertyListService.getHistory(city, url).subscribe({
            next: (res) => {
                this.history.set(res);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Failed to load property history.');
                this.history.set(null);
                this.loading.set(false);
                console.error(err);
            }
        });
    }
}
