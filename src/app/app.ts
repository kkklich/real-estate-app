import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { ScrapeButtonComponent } from './components/scrape-button/scrape-button.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, ScrapeButtonComponent],
    templateUrl: './app.html'
})
export class App { }
