import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
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
