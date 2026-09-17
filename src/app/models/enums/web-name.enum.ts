/** Mirrors the WebName enum on the API - the portal an offer was scraped from. */
export enum WebName {
    Olx = 0,
    Morizon = 1,
    NieruchomosciOnline = 2
}

const PORTAL_NAMES: Readonly<Record<number, string>> = {
    [WebName.Olx]: 'OLX',
    [WebName.Morizon]: 'Morizon',
    [WebName.NieruchomosciOnline]: 'Nieruchomości-online'
};

/** Falls back to the raw id so a portal added on the API side is visible, not blank. */
export function portalName(webName: number): string {
    return PORTAL_NAMES[webName] ?? `#${webName}`;
}
