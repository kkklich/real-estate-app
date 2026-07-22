# real-estate-app

The dashboard of the Real Estate App: price statistics, distribution and trend
charts, a map of offers and a browsable, filterable list of listings scraped
from Polish property portals.

Angular 20 (standalone, **zoneless**, signal-based) · Angular Material ·
Chart.js · MapLibre GL · SSR

## Running it

```bash
npm install
npm start
```

Opens on **http://localhost:4200** and expects the API on
**http://localhost:5016** (`src/enviroments/environment.ts`). Without the API
running, the dashboard loads empty and logs `getFullDashboard error`.

> If the build dies with a JavaScript heap error, cap the workers first:
> `$env:NG_BUILD_MAX_WORKERS=1` (PowerShell) — parallel workers exhaust memory
> on this project.

## Building

```bash
npm run build
```

`outputMode` is `"server"`, so this emits a **Node SSR server**, not a static
folder:

```
dist/real-estate-app/
  browser/                 client bundles
  server/server.mjs        run this — `npm run serve:ssr:real-estate-app`
```

Uploading `browser/` over FTP is not enough. There is a separate `static`
configuration if you need a plain-file deployment; it trades away SSR.

Production builds use `baseHref: /realestate/` — the app expects to be served
from a subpath, not the domain root. Override per build with `--base-href`.

## Screens

| Route | What |
|---|---|
| `/` | dashboard — summary cards, price trend, price/m² histogram, district medians, market & building-type donuts, map, market insights |
| `/properties` | every distinct offer: filter, sort, page |
| `/properties/history` | price history of one offer across scrapes |

The toolbar switches city (Kraków / Katowice). That is the main input the whole
dashboard reacts to.

## How the state works

One service, one signal graph — no NgRx, no RxJS state.

```
city signal ──effect──► getFullDashboard(city) ──┬─► charts    ─► chart components
                                                 ├─► insights  ─► market insights
                                                 └─► mapPoints ─► map
```

[`CalculateStatisticsService`](src/app/services/calculate-statistics.ts) holds
the city and the three response slices. Changing the city sets one signal; an
`effect` fires the request — wrapped in `untracked()` so it depends on `city`
alone — and components read `computed()` projections. Nothing writes back to
the store.

The whole dashboard is **one HTTP call** (`getFullDashboard/{city}`), cached per
city in [`RealEstateDataService`](src/app/services/real-estate-data.service.ts)
with `shareReplay`, so revisiting a city replays instantly. A failed request
drops its cache entry so the next visit retries instead of replaying the error.

`/properties` is independent: it owns its filter, sort and paging signals and
calls [`PropertyListService`](src/app/services/property-list.service.ts)
directly.

## Layout

```
src/app/
  components/
    dashboard/           the page that composes everything
    search-filter/       city + group-by toolbar
    summary-cards/       medians and counts
    market-insights/     ranges, source split, best deals
    charts/              price-trend · price-histogram · district-price ·
                         split-donut · map-view
    properties/          properties-list · property-history
  models/                the API response shapes
  services/              the three services above
  enviroments/           apiUrl and the MapTiler key
```

## Things worth knowing

- **Zoneless.** `provideZonelessChangeDetection()` — state must go through
  signals. A plain field mutation will not repaint.
- **SSR guards.** The map uses WebGL and cannot render on the server;
  `map-view` is behind `isPlatformBrowser`. Anything touching `window`,
  `document` or a canvas needs the same treatment.
- **Locale is `pl`**, registered globally, so prices and dates format Polish
  regardless of the browser.
- **The MapTiler key in `environment.ts` is public** — it ships in the client
  bundle by necessity. Restrict it by HTTP referrer in the MapTiler console
  rather than trying to hide it.
- **Map colours come from the API**, not the client: `BuildMapPoints`
  colour-grades points blue→red by price per m².

## More

The API contract and the data model it reflects — snapshots, batch semantics,
duplicate detection, caching — are documented in `ARCHITECTURE.md` in the parent
workspace (`realEstateApp/`), next to `DEPLOYMENT.md`.
