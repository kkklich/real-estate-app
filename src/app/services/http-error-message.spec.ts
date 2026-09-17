import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage } from './http-error-message';

describe('httpErrorMessage', () => {

    const failWith = (status: number) => new HttpErrorResponse({ status });

    it('says the server could not be reached when no response arrived', () => {
        expect(httpErrorMessage(failWith(0), 'price drops'))
            .toBe('Could not reach the server while loading price drops. Check your connection and try again.');
    });

    it('says no data was found on a 404', () => {
        expect(httpErrorMessage(failWith(404), 'price drops')).toBe('No data found for price drops.');
    });

    it('blames the server on any 5xx', () => {
        for (const status of [500, 502, 503]) {
            expect(httpErrorMessage(failWith(status), 'price drops'))
                .toBe('The server failed while loading price drops. Try again in a moment.');
        }
    });

    it('includes the status for other HTTP failures', () => {
        expect(httpErrorMessage(failWith(400), 'price drops')).toBe('Could not load price drops (HTTP 400).');
    });

    it('falls back to a generic message for errors that are not HTTP responses', () => {
        expect(httpErrorMessage(new Error('boom'), 'price drops')).toBe('Could not load price drops.');
        expect(httpErrorMessage(undefined, 'price drops')).toBe('Could not load price drops.');
    });
});
