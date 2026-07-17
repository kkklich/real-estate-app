import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PropertyListService } from '../../../services/property-list.service';
import { PropertyListItem } from '../../../models/propertyListItem';
import { PagedResult } from '../../../models/pagedResult';
import { PropertyQuery } from '../../../models/propertyQuery';
import { cityEnum } from '../../../models/enums/city.enum';

interface SortableColumn {
    key: string;
    label: string;
}

@Component({
    selector: 'app-properties-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatPaginatorModule
    ],
    templateUrl: './properties-list.component.html',
    styleUrl: './properties-list.component.scss'
})
export class PropertiesListComponent {

    readonly cityList = Object.values(cityEnum);

    readonly columns: SortableColumn[] = [
        { key: 'title', label: 'Title' },
        { key: 'city', label: 'City' },
        { key: 'district', label: 'District' },
        { key: 'market', label: 'Market' },
        { key: 'price', label: 'Price' },
        { key: 'pricePerMeter', label: 'Price / m²' },
        { key: 'area', label: 'Area' },
        { key: 'floor', label: 'Floor' }
    ];

    readonly pageSizeOptions = [10, 25, 50];

    // Filters
    readonly city = signal<string>('');
    readonly market = signal<string>('');
    readonly priceMin = signal<number | null>(null);
    readonly priceMax = signal<number | null>(null);
    readonly areaMin = signal<number | null>(null);
    readonly areaMax = signal<number | null>(null);
    readonly search = signal<string>('');

    // Sort
    readonly sortBy = signal<string>('lastSeen');
    readonly sortDir = signal<'asc' | 'desc'>('desc');

    // Paging
    readonly page = signal<number>(1);
    readonly pageSize = signal<number>(10);

    // Result state
    readonly result = signal<PagedResult<PropertyListItem> | null>(null);
    readonly loading = signal<boolean>(false);
    readonly error = signal<string | null>(null);

    // MatPaginator is zero-based; the API is one-based.
    readonly pageIndex = computed(() => this.page() - 1);

    constructor(private readonly propertyListService: PropertyListService) {
        this.load();
    }

    applyFilters(): void {
        this.page.set(1);
        this.load();
    }

    sortByColumn(key: string): void {
        if (this.sortBy() === key) {
            this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortBy.set(key);
            this.sortDir.set('asc');
        }
        this.page.set(1);
        this.load();
    }

    onPage(event: PageEvent): void {
        this.page.set(event.pageIndex + 1);
        this.pageSize.set(event.pageSize);
        this.load();
    }

    private buildQuery(): PropertyQuery {
        return {
            page: this.page(),
            pageSize: this.pageSize(),
            sortBy: this.sortBy(),
            sortDir: this.sortDir(),
            city: this.city() || undefined,
            market: this.market() || undefined,
            priceMin: this.priceMin() ?? undefined,
            priceMax: this.priceMax() ?? undefined,
            areaMin: this.areaMin() ?? undefined,
            areaMax: this.areaMax() ?? undefined,
            search: this.search() || undefined
        };
    }

    private load(): void {
        this.loading.set(true);
        this.error.set(null);
        this.propertyListService.getProperties(this.buildQuery()).subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Failed to load properties.');
                this.result.set(null);
                this.loading.set(false);
                console.error(err);
            }
        });
    }
}
