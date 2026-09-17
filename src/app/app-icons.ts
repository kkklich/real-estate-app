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
    error_outline: 'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
    map: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z',
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
