import { createPublicKey, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

/**
 * Anmeldung in der Teams-App (Single Sign-on): Teams gibt dem Reiter über `authentication.getAuthToken()` ein Zugriffstoken
 * der angemeldeten Person für unsere App-Registrierung. Hier wird es geprüft – ohne Zusatzpaket, nur mit node:crypto:
 *
 * - Signatur RS256 mit einem Schlüssel von Microsoft (Liste des eigenen Mandanten, `kid` aus dem Kopf), kein anderes Verfahren
 * - Aussteller (`iss`) und Mandant (`tid`) des eigenen Mandanten, Empfänger (`aud`) unsere App
 * - gültig (`exp`, `nbf`, eine Minute Spielraum), Bereich `access_as_user`
 * - angefordert von Teams, Outlook oder Microsoft 365 (`azp`/`appid`) – so kann keine andere App, der jemand zugestimmt hat,
 *   mit einem Token für uns eine Sitzung anlegen
 *
 * Voraussetzung in der App-Registrierung („API verfügbar machen“): Anwendungs-ID-URI `api://<Host des Portals>/<Client-ID>`,
 * Bereich `access_as_user`, Teams als berechtigte Clientanwendung (docs/entra-einrichtung.md).
 */
export const TEAMS_BEREICH = 'access_as_user';

/** Clients, die das Token anfordern dürfen – Teams, Microsoft 365 und Outlook (Liste von Microsoft) */
export const TEAMS_CLIENTS: Record<string, string> = {
  '1fec8e78-bce4-4aaf-ab1b-5451cc387264': 'Teams (Desktop, Mobil)',
  '5e3ce6c0-2b1f-4285-8d4b-75ee78787346': 'Teams im Browser',
  '4765445b-32c6-49b0-83e6-1d93765276ca': 'Microsoft 365 im Browser',
  '0ec893e0-5785-4de6-99da-4ed124e5296c': 'Microsoft 365 (Desktop)',
  'd3590ed6-52b3-4102-aeff-aad2292ab01c': 'Microsoft 365 (Mobil), Outlook (Desktop)',
  'bc59ab01-8403-45c6-8796-ac3ef710b3e3': 'Outlook im Browser',
  '27922004-5251-4030-b22d-91ecd9a37ea4': 'Outlook (Mobil)',
};

/** Anwendungs-ID-URI der App für Teams-SSO */
export function teamsRessource(appUrl: string, clientId: string): string {
  return `api://${new URL(appUrl).host}/${clientId}`;
}

export class TeamsSsoFehler extends Error {}

/** Holt einen öffentlichen Schlüssel von Microsoft zur Kennung `kid` – oder null. */
export type Schluessel = (kid: string) => Promise<KeyObject | null>;

/** Schlüssel des Mandanten von Microsoft, einen Tag zwischengespeichert; ein unbekannter `kid` lädt die Liste neu (höchstens alle 5 Minuten). */
export function microsoftSchluessel(tenantId: string): Schluessel {
  let liste: { schluessel: Map<string, KeyObject>; geladen: number } | null = null;
  const lade = async () => {
    const r = await fetch(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new TeamsSsoFehler('Die Schlüssel von Microsoft sind nicht erreichbar (login.microsoftonline.com).');
    const j = (await r.json()) as { keys?: { kid?: string; kty?: string; n?: string; e?: string }[] };
    const schluessel = new Map<string, KeyObject>();
    for (const k of j.keys ?? []) {
      if (k.kty !== 'RSA' || typeof k.kid !== 'string' || !k.n || !k.e) continue;
      schluessel.set(k.kid, createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }));
    }
    liste = { schluessel, geladen: Date.now() };
  };
  return async (kid) => {
    if (!liste || Date.now() - liste.geladen > 24 * 3600_000) await lade();
    if (!liste!.schluessel.has(kid) && Date.now() - liste!.geladen > 5 * 60_000) await lade();
    return liste!.schluessel.get(kid) ?? null;
  };
}

function teil<T>(s: string, was: string): T {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as T;
  } catch {
    throw new TeamsSsoFehler(`Token ungültig (${was}).`);
  }
}

export interface TeamsPerson {
  oid: string;
  anmeldename: string;
}

/** Prüft das Token von Teams; wirft TeamsSsoFehler mit verständlicher Meldung. */
export async function pruefeTeamsToken(token: string, e: { tenantId: string; clientId: string; appUrl: string }, schluessel: Schluessel, jetzt: Date): Promise<TeamsPerson> {
  const teile = token.split('.');
  if (teile.length !== 3 || token.length > 8000) throw new TeamsSsoFehler('Token ungültig (Form).');
  const kopf = teil<{ alg?: string; kid?: string; typ?: string }>(teile[0], 'Kopf');
  if (kopf.alg !== 'RS256' || typeof kopf.kid !== 'string') throw new TeamsSsoFehler('Token ungültig (Verfahren).');
  const k = await schluessel(kopf.kid);
  if (!k) throw new TeamsSsoFehler('Token ungültig (unbekannter Schlüssel).');
  if (!verify('RSA-SHA256', Buffer.from(`${teile[0]}.${teile[1]}`), k, Buffer.from(teile[2], 'base64url'))) throw new TeamsSsoFehler('Token ungültig (Signatur).');
  const p = teil<Record<string, unknown>>(teile[1], 'Inhalt');

  const aussteller = [`https://sts.windows.net/${e.tenantId}/`, `https://login.microsoftonline.com/${e.tenantId}/v2.0`];
  if (typeof p.iss !== 'string' || !aussteller.includes(p.iss) || p.tid !== e.tenantId) throw new TeamsSsoFehler('Das Token stammt aus einem anderen Microsoft-Mandanten.');
  const ressource = teamsRessource(e.appUrl, e.clientId);
  if (p.aud !== ressource && p.aud !== e.clientId) throw new TeamsSsoFehler(`Das Token ist für eine andere App ausgestellt. Erwartet: ${ressource}`);
  const sek = jetzt.getTime() / 1000;
  if (typeof p.exp !== 'number' || p.exp < sek - 60) throw new TeamsSsoFehler('Das Token ist abgelaufen.');
  if (typeof p.nbf === 'number' && p.nbf > sek + 60) throw new TeamsSsoFehler('Das Token gilt noch nicht.');
  if (!String(p.scp ?? '').split(' ').includes(TEAMS_BEREICH)) throw new TeamsSsoFehler(`Dem Token fehlt der Bereich ${TEAMS_BEREICH}.`);
  if (!Object.hasOwn(TEAMS_CLIENTS, String(p.azp ?? p.appid ?? ''))) throw new TeamsSsoFehler('Das Token wurde nicht von Teams, Outlook oder Microsoft 365 angefordert.');
  const oid = typeof p.oid === 'string' ? p.oid : '';
  if (!oid) throw new TeamsSsoFehler('Dem Token fehlt die Objekt-ID der Person.');
  const anmeldename = String(p.preferred_username ?? p.upn ?? '').toLowerCase();
  return { oid, anmeldename };
}
