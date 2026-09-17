import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAppIcons } from './app-icons';

registerLocaleData(localePl);

// Deliberately absent from the root:
// - Chart.js registration lives on the chart-hosting components (provideAppCharts), so
//   Chart.js loads with those routes instead of with every page.
// - provideAnimations(): Angular Material 20 animates with CSS and no longer imports
//   @angular/animations, so the module was 61 kB of initial bundle doing nothing.
export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideClientHydration(withEventReplay()),
        provideHttpClient(withFetch()),
        provideAppIcons(),
        { provide: LOCALE_ID, useValue: 'pl' }
    ]
};
