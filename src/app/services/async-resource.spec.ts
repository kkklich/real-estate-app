import { AsyncResource } from './async-resource';

describe('AsyncResource', () => {

    it('starts out loading, empty and not yet settled', () => {
        const resource = new AsyncResource<number>();

        expect(resource.loading()).toBeTrue();
        expect(resource.data()).toBeNull();
        expect(resource.error()).toBeNull();
        expect(resource.settled()).toBeFalse();
    });

    it('exposes the payload once a request succeeds', () => {
        const resource = new AsyncResource<number>();

        resource.succeed(42);

        expect(resource.data()).toBe(42);
        expect(resource.loading()).toBeFalse();
        expect(resource.error()).toBeNull();
        expect(resource.settled()).toBeTrue();
    });

    // The original bug: a failure left data null, which the views read as "still loading".
    it('reports a failure as an error, never as loading or as empty data', () => {
        const resource = new AsyncResource<number[]>();

        resource.fail('Server down');

        expect(resource.error()).toBe('Server down');
        expect(resource.loading()).toBeFalse();
        expect(resource.data()).toBeNull();
        expect(resource.settled()).toBeTrue();
    });

    it('drops the previous payload when a new request starts, but stays settled', () => {
        const resource = new AsyncResource<string>();
        resource.succeed('Krakow data');

        resource.start();

        expect(resource.data()).toBeNull();
        expect(resource.loading()).toBeTrue();
        expect(resource.settled()).toBeTrue();
    });

    it('clears a previous error when a new request starts', () => {
        const resource = new AsyncResource<string>();
        resource.fail('Server down');

        resource.start();

        expect(resource.error()).toBeNull();
        expect(resource.loading()).toBeTrue();
    });
});
