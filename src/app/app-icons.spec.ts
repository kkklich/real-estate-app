import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { APP_ICON_NAMES, provideAppIcons } from './app-icons';

describe('provideAppIcons', () => {

    beforeEach(() => TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), provideAppIcons()]
    }));

    it('registers every icon the templates use as an inline SVG', async () => {
        const registry = TestBed.inject(MatIconRegistry);

        expect(APP_ICON_NAMES).toEqual(jasmine.arrayWithExactContents(['error_outline', 'map', 'trending_flat']));
        for (const name of APP_ICON_NAMES) {
            const svg = await firstValueFrom(registry.getNamedSvgIcon(name));
            expect(svg.tagName.toLowerCase()).withContext(name).toBe('svg');
            expect(svg.querySelector('path')?.getAttribute('d')).withContext(name).toBeTruthy();
        }
    });
});
