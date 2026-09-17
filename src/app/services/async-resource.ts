import { signal } from '@angular/core';

/**
 * Three-state holder for one remote resource: loading, failed, or ready.
 *
 * Exists because deriving "loading" from "data === null" collapses failure into
 * loading: a dead request then renders as a spinner that never resolves, and an
 * error mapped to an empty array renders as a legitimate empty result. Exactly
 * one of `loading` / `error` / `data` is meaningful at any moment.
 */
export class AsyncResource<T> {

    private readonly _data = signal<T | null>(null);
    private readonly _error = signal<string | null>(null);
    private readonly _loading = signal<boolean>(true);
    private readonly _settled = signal<boolean>(false);

    /** Payload of the last successful load; null while loading and after a failure. */
    readonly data = this._data.asReadonly();
    /** User-facing failure message; null while loading and when ready. */
    readonly error = this._error.asReadonly();
    readonly loading = this._loading.asReadonly();
    /**
     * True once any request has finished, successfully or not, and never reset.
     * Lets a view tell the very first load - which may deserve a full-page wait -
     * from a later refresh, which should not tear the surrounding page down.
     */
    readonly settled = this._settled.asReadonly();

    /**
     * A request is in flight. Drops the previous payload on purpose - keeping it
     * would let the view render the old city's numbers as if they were the new one's.
     */
    start(): void {
        this._loading.set(true);
        this._error.set(null);
        this._data.set(null);
    }

    succeed(value: T): void {
        this._data.set(value);
        this._error.set(null);
        this._loading.set(false);
        this._settled.set(true);
    }

    fail(message: string): void {
        this._data.set(null);
        this._error.set(message);
        this._loading.set(false);
        this._settled.set(true);
    }
}
