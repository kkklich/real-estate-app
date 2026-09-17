import { Routes } from '@angular/router';

// Every page is lazy, the dashboard included: it carries Chart.js and the dashboard widgets,
// which /properties never needs. It is still the landing page, so its chunk is requested
// straight after bootstrap - but it no longer inflates the bundle every route pays for.
export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./components/dashboard/dashboard.component')
                .then(m => m.DashboardComponent)
    },
    {
        path: 'properties',
        loadComponent: () =>
            import('./components/properties/properties-list/properties-list.component')
                .then(m => m.PropertiesListComponent)
    },
    {
        path: 'properties/history',
        loadComponent: () =>
            import('./components/properties/property-history/property-history.component')
                .then(m => m.PropertyHistoryComponent)
    },
    { path: '**', redirectTo: '' }
];
