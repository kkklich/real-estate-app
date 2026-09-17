import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a failed request into a message worth showing a user.
 *
 * `subject` is a lowercase noun phrase that reads naturally mid-sentence,
 * e.g. 'the dashboard', 'price drops', "this offer's history".
 */
export function httpErrorMessage(err: unknown, subject: string): string {
    if (err instanceof HttpErrorResponse) {
        if (err.status === 0) {
            return `Could not reach the server while loading ${subject}. Check your connection and try again.`;
        }
        if (err.status === 404) {
            return `No data found for ${subject}.`;
        }
        if (err.status >= 500) {
            return `The server failed while loading ${subject}. Try again in a moment.`;
        }
        return `Could not load ${subject} (HTTP ${err.status}).`;
    }
    return `Could not load ${subject}.`;
}
