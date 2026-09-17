import { isDevMode } from '@angular/core';
import { bootstrapApplication, enableDebugTools } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
    .then(app => {
        // ng.profiler is a development aid, and it pins a reference to the root
        // component - it has no business in a production bundle.
        if (isDevMode()) {
            enableDebugTools(app.components[0]);
        }
    })
    .catch(err => console.error(err));
