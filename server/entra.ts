import { createHash, randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';

/**
 * Anmeldung über Microsoft Entra ID: OpenID Connect, Authorization Code Flow mit PKCE,
 * vertraulicher Client.
 *
 * Discovery, Einlösen des Codes und die Prüfung des ID-Tokens (Signatur, Aussteller, Empfänger,
 * Ablauf, Nonce) übernimmt die Bibliothek openid-client. Hier bleibt nur, was zu Entra und zu
 * dieser App gehört: Mandant prüfen, Objekt-ID und Anmeldename herauslesen.
 */
export interface EntraKonfig {
  /** z. B. https://login.microsoftonline.com/<tenant-id>/v2.0 */
  aussteller: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Mandant, aus dem Anmeldungen angenommen werden (Claim tid) */
  tenantId?: string;
  /** Profilbild über Microsoft Graph holen – verlangt zusätzlich die Berechtigung User.Read */
  profilbild?: boolean;
  /** Adresse von Microsoft Graph (in Tests ein nachgestellter Dienst) */
  graphUrl?: string;
}

export interface Profilbild {
  typ: 'image/jpeg' | 'image/png';
  daten: Buffer;
}

export interface EntraIdentitaet {
  /** unveränderliche Objekt-ID des Kontos im Mandanten */
  oid: string;
  /** Anmeldename (UPN), klein geschrieben */
  anmeldename: string;
  name: string;
  /** Profilbild: undefined = nicht abgefragt oder Abruf fehlgeschlagen, null = die Person hat keins */
  bild?: Profilbild | null;
  /** warum der Abruf des Bilds fehlschlug – fürs Log */
  bildFehler?: string;
}

const BILD_MAX = 300_000;

/**
 * Holt das kleine Profilbild (96 × 96) der angemeldeten Person aus Microsoft Graph.
 * 404 heißt: kein Bild hinterlegt. Alles andere Unerwartete wirft – die Anmeldung läuft trotzdem weiter.
 */
export async function holeProfilbild(graphUrl: string, zugriffstoken: string, hole: typeof fetch = fetch): Promise<Profilbild | null> {
  const r = await hole(`${graphUrl.replace(/\/+$/, '')}/v1.0/me/photos/96x96/$value`, { headers: { Authorization: `Bearer ${zugriffstoken}` }, redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Microsoft Graph antwortet mit Status ${r.status}`);
  const daten = Buffer.from(await r.arrayBuffer());
  if (daten.length === 0 || daten.length > BILD_MAX) throw new Error('Das Profilbild ist leer oder zu groß');
  // nach dem Inhalt gehen, nicht nach der Angabe des Servers
  if (daten[0] === 0xff && daten[1] === 0xd8 && daten[2] === 0xff) return { typ: 'image/jpeg', daten };
  if (daten.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { typ: 'image/png', daten };
  throw new Error('Das Profilbild ist weder JPEG noch PNG');
}

export interface Entra {
  anmeldeUrl(p: { state: string; nonce: string; challenge: string }): Promise<string>;
  loeseEin(p: { code: string; state: string; verifier: string; nonce: string }): Promise<EntraIdentitaet>;
}

const KONFIGURATION_MS = 24 * 60 * 60 * 1000;
const ZEITLIMIT_S = 10;

export function zufall(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** PKCE: code_challenge = BASE64URL(SHA-256(code_verifier)) */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function entraAussteller(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

/** Fehlertext fürs Server-Log: Art und Meldung, bei Ablehnung durch Entra auch dessen Fehlercode – nie Geheimnisse. */
export function fehlerText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const teile = [e.message];
  const extra = e as { code?: unknown; error?: unknown; error_description?: unknown; cause?: unknown };
  if (typeof extra.code === 'string') teile.push(`(${extra.code})`);
  if (typeof extra.error === 'string') teile.push(extra.error);
  if (typeof extra.error_description === 'string') teile.push(extra.error_description.split('\n')[0].slice(0, 200));
  if (extra.cause instanceof Error && extra.cause.message !== e.message) teile.push(`– ${extra.cause.message}`);
  return teile.join(' ');
}

export function erzeugeEntra(k: EntraKonfig): Entra {
  let konfiguration: { wert: oidc.Configuration; geladen: number } | null = null;
  // Unverschlüsselt nur gegen einen Anbieter auf dem eigenen Rechner (Tests, Entwicklung) – nie gegen Entra
  const lokal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(k.aussteller);

  async function lade(): Promise<oidc.Configuration> {
    if (konfiguration && Date.now() - konfiguration.geladen < KONFIGURATION_MS) return konfiguration.wert;
    const wert = await oidc.discovery(
      new URL(k.aussteller),
      k.clientId,
      // nur RS256-signierte ID-Tokens annehmen
      { id_token_signed_response_alg: 'RS256' },
      oidc.ClientSecretPost(k.clientSecret),
      {
        // Die Signatur des ID-Tokens immer gegen die Schlüssel des Ausstellers prüfen. Ohne diese Einstellung
        // verlässt sich die Bibliothek darauf, dass das Token über TLS direkt vom Aussteller kam.
        execute: lokal ? [oidc.enableNonRepudiationChecks, oidc.allowInsecureRequests] : [oidc.enableNonRepudiationChecks],
        timeout: ZEITLIMIT_S,
      },
    );
    konfiguration = { wert, geladen: Date.now() };
    return wert;
  }

  return {
    async anmeldeUrl({ state, nonce, challenge }) {
      const cfg = await lade();
      return oidc
        .buildAuthorizationUrl(cfg, {
          redirect_uri: k.redirectUri,
          response_mode: 'query',
          scope: k.profilbild ? 'openid profile email User.Read' : 'openid profile email',
          state,
          nonce,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        })
        .toString();
    },

    async loeseEin({ code, state, verifier, nonce }) {
      const cfg = await lade();
      const antwort = new URL(k.redirectUri);
      antwort.searchParams.set('code', code);
      antwort.searchParams.set('state', state);
      const tokens = await oidc.authorizationCodeGrant(cfg, antwort, {
        pkceCodeVerifier: verifier,
        expectedNonce: nonce,
        expectedState: state,
        idTokenExpected: true,
      });
      const c = tokens.claims();
      if (!c) throw new Error('Entra hat kein ID-Token geliefert');
      if (k.tenantId && c.tid !== k.tenantId) throw new Error('ID-Token: falscher Mandant');
      if (typeof c.oid !== 'string' || !c.oid) throw new Error('ID-Token: Objekt-ID fehlt');
      if (typeof c.preferred_username !== 'string' || !c.preferred_username) throw new Error('ID-Token: Anmeldename fehlt');
      const wer: EntraIdentitaet = {
        oid: c.oid.toLowerCase(),
        anmeldename: c.preferred_username.trim().toLowerCase(),
        name: typeof c.name === 'string' ? c.name : '',
      };
      if (k.profilbild) {
        // das Bild ist Beiwerk: Schlägt der Abruf fehl, gelingt die Anmeldung trotzdem
        try {
          if (!tokens.access_token) throw new Error('Entra hat kein Zugriffstoken geliefert');
          wer.bild = await holeProfilbild(k.graphUrl ?? 'https://graph.microsoft.com', tokens.access_token);
        } catch (e) {
          wer.bildFehler = e instanceof Error ? e.message.slice(0, 200) : 'unbekannter Fehler';
        }
      }
      return wer;
    },
  };
}
