import { normalizeOfferUrl } from './offer-url';

// Mirrors PropertyComparer.NormalizeUrl in the API: the two must agree on which links are
// one listing, or the history page counts re-posts the API never merged.
describe('normalizeOfferUrl', () => {

    it('ignores case, the query string, the fragment and trailing slashes', () => {
        const base = 'https://www.otodom.pl/pl/oferta/mieszkanie-ID4abc';

        for (const variant of [
            base,
            'https://WWW.Otodom.pl/pl/oferta/Mieszkanie-ID4abc',
            `${base}?utm_source=olx&page=2`,
            `${base}#gallery`,
            `${base}/`,
            `${base}//?x=1#y`,
            `  ${base}  `
        ]) {
            expect(normalizeOfferUrl(variant)).withContext(variant).toBe(base.toLowerCase());
        }
    });

    it('tells different paths apart', () => {
        expect(normalizeOfferUrl('https://example.com/offer-1'))
            .not.toBe(normalizeOfferUrl('https://example.com/offer-2'));
    });

    it('reads a missing link as empty', () => {
        expect(normalizeOfferUrl(null)).toBe('');
        expect(normalizeOfferUrl(undefined)).toBe('');
        expect(normalizeOfferUrl('   ')).toBe('');
    });
});
