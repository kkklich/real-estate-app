import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DashboardComponent } from "./components/dashboard/dashboard.component";

@Component({
    selector: 'app-root',
    imports: [DashboardComponent],
    templateUrl: './app.html',
    standalone: true,
})
export class App {
    protected readonly title = signal('real-estate-app');
}
