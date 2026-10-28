import { validSnapshotDate } from './snapshot-date';

describe('validSnapshotDate', () => {
    it('interprets database timestamps without a zone as UTC, preserving fractional seconds', () => {
        expect(validSnapshotDate('2026-09-21T21:01:08.298453')).toBe('2026-09-21T21:01:08.298453Z');
    });
    it('preserves explicit time zones', () => {
        expect(validSnapshotDate('2026-09-21T21:01:08Z')).toBe('2026-09-21T21:01:08Z');
        expect(validSnapshotDate('2026-09-21T21:01:08+02:00')).toBe('2026-09-21T21:01:08+02:00');
    });
    it('rejects missing and invalid timestamps', () => {
        for (const value of [null, undefined, '', 'not a date']) expect(validSnapshotDate(value)).toBeNull();
    });
});
