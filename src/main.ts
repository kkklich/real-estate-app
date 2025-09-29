import { bootstrapApplication, enableDebugTools } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
    .then(app => enableDebugTools(app.components[0]))
    .catch(err => console.error(err));
