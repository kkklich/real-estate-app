/**
 * Colours for the Chart.js canvases. Charts are drawn from TypeScript and cannot read the SCSS
 * tokens in src/styles/_tokens.scss, so the values both sides share are mirrored here - change
 * one, change the other.
 */
export const CHART_COLORS = {
    /** Mirrors $color-text: category labels on the district axis. */
    text: '#22294a',
    /** Mirrors $color-text-muted: tick labels, axis titles, legend text. */
    textMuted: '#6d748a',
    /** Mirrors $color-brand: the primary series and hover highlights. */
    brand: '#234392',
    /** Horizontal grid lines. */
    grid: '#e9ecf6'
} as const;
