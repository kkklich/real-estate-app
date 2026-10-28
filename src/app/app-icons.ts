import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';

/**
 * The icons the app shows, as inline SVG paths.
 *
 * <mat-icon> with a ligature name ("error_outline") needs the Material Icons web font, and
 * that font was never loaded - every icon rendered as its raw name. Registering SVGs instead
 * needs no font and no request to Google Fonts for each visitor.
 *
 * Paths are the "baseline" Material Icons, Apache License 2.0,
 * https://github.com/google/material-design-icons
 */
const ICON_PATHS = {
    cloud_download: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z',
    error_outline: 'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
    map: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z',
    refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    trending_flat: 'M22 12l-4-4v3H3v2h15v3z'
} as const;

export type AppIconName = keyof typeof ICON_PATHS;
export const APP_ICON_NAMES = Object.keys(ICON_PATHS) as AppIconName[];

/** Registers every icon above; use as <mat-icon svgIcon="error_outline"></mat-icon>. */
export function provideAppIcons(): EnvironmentProviders {
    return provideEnvironmentInitializer(() => {
        const registry = inject(MatIconRegistry);
        const sanitizer = inject(DomSanitizer);
        for (const name of APP_ICON_NAMES) {
            // Trusting is safe here: the markup is built only from the constant paths above.
            registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ICON_PATHS[name]}"/></svg>`
            ));
        }
    });
}
