import { WebName, portalName } from './web-name.enum';

describe('portalName', () => {

    it('names every portal the API knows about', () => {
        expect(portalName(WebName.Olx)).toBe('OLX');
        expect(portalName(WebName.Morizon)).toBe('Morizon');
        expect(portalName(WebName.NieruchomosciOnline)).toBe('Nieruchomości-online');
    });

    it('shows the raw id for a portal added on the API side, rather than a blank', () => {
        expect(portalName(7)).toBe('#7');
    });
});
