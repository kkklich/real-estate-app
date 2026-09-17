import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    // The page is addressed entirely by ?city= and ?url=, which do not exist at
    // build time - prerendering it can only ever capture the "missing parameter"
    // error state and ship that as the static HTML for every offer. Rendered on
    // the client instead, where the query string is actually known.
    {
        path: 'properties/history',
        renderMode: RenderMode.Client
    },

    // Dashboard and the properties list prerender to their loading shell: the
    // chrome is static, the data is fetched by the browser (see the isBrowser
    // guards in CalculateStatisticsService / PropertiesListComponent).
    {
        path: '**',
        renderMode: RenderMode.Prerender
    }
];
