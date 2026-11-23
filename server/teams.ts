import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Kontext, Route } from './api-basis';
import { leseBetrieb } from './stammdaten';
import { protokolliere } from './protokoll';
import { umrissSymbol } from './png';
import { baueZip } from './zip';

/**
 * Teams-App: Benachrichtigungen erscheinen in Teams unter „Aktivität“, Absender ist die App „Ausbildungsportal“.
 *
 * - Versand über Microsoft Graph (sendActivityNotification) mit der Anwendungsberechtigung TeamsActivity.Send –
 *   mit der App-Registrierung, die auch die Anmeldung nutzt. Empfänger ist die Entra-Objekt-ID der Person.
 * - Ankommen kann nur etwas, wenn die App bei der Person installiert ist (Teams Admin Center, Setup-Richtlinie).
 * - Das App-Paket (manifest.json, zwei Symbole) lädt der Super-Admin unter „Erscheinungsbild“ herunter.
 * - Die App-ID steht fest in TEAMS_APP_ID; erst damit gehen Nachrichten hinaus. Vorher zeigt das Portal eine
 *   vorgeschlagene ID, die mit dem Paket heruntergeladen und dann in die .env übernommen wird.
 * - Ein Klick auf die Meldung öffnet den Reiter der App (/teams/app) mit dem Ziel im Portal.
 */

/** entityId des Reiters im Manifest */
export const REITER = 'portal';
/** Version des Manifest-Schemas */
export const MANIFEST_VERSION = '1.19';
/** Farbe hinter dem Symbol – wie im Zeichen des Portals (public/favicon.svg) */
const AKZENT = '#4338CA';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ein Fehler von Microsoft – mit Status und Code, aber ohne Token oder Geheimnis */
export class GraphFehler extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`Microsoft antwortet mit Status ${status}${code ? ` (${code})` : ''}`);
  }
}

/**
 * Schickt eine Anfrage an Microsoft Graph als App (Client-Credentials) – das Token wird bis kurz vor Ablauf wiederverwendet.
 * Umleitungen werden nicht verfolgt, nach acht Sekunden ist Schluss.
 */
export function erzeugeGraph(entra: { tenantId: string; clientId: string; clientSecret: string }): Kontext['graph'] {
  let token: { wert: string; bis: number } | null = null;
  const holeToken = async (): Promise<string> => {
    if (token && token.bis > Date.now() + 60_000) return token.wert;
    const r = await fetch(`https://login.microsoftonline.com/${entra.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: entra.clientId, client_secret: entra.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!r.ok || typeof j.access_token !== 'string') throw new GraphFehler(r.status, typeof j.error === 'string' ? j.error.slice(0, 60) : 'token');
    token = { wert: j.access_token, bis: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return token.wert;
  };
  return async (pfad, body) => {
    const r = await fetch(`https://graph.microsoft.com/v1.0${pfad}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await holeToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return;
    const j = (await r.json().catch(() => ({}))) as { error?: { code?: unknown } };
    throw new GraphFehler(r.status, typeof j.error?.code === 'string' ? j.error.code.slice(0, 60) : '');
  };
}

/** Verständlicher Grund für einen Fehler beim Versand – ohne Empfänger und ohne Geheimnisse */
export function teamsFehlertext(e: unknown): string {
  if (e instanceof GraphFehler) {
    if (e.code === 'invalid_client' || e.code === 'unauthorized_client') return 'Microsoft lehnt die Anmeldung des Portals ab: Client-ID oder Geheimnis (ENTRA_CLIENT_SECRET) prüfen.';
    if (e.status === 401 || e.status === 403) return 'Microsoft lehnt ab: Der App-Registrierung fehlt die Anwendungsberechtigung TeamsActivity.Send (mit Administratorzustimmung), oder das App-Paket gehört zu einer anderen App-Registrierung.';
    if (e.status === 404) return 'Microsoft findet die Person oder die App nicht: Ist die Teams-App für diese Person installiert?';
    if (e.status === 429) return 'Microsoft bremst gerade (zu viele Anfragen). Später noch einmal versuchen.';
    return `Teams antwortet mit einem Fehler (Status ${e.status}).`;
  }
  if (e instanceof Error && e.name === 'TimeoutError') return 'Microsoft antwortet nicht.';
  return 'Microsoft ist nicht erreichbar. Der Server braucht ausgehend login.microsoftonline.com und graph.microsoft.com.';
}

const lies = (k: Kontext, schluessel: string) => (k.db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').get(schluessel) as { wert: string } | undefined)?.wert ?? null;
const schreibe = (k: Kontext, schluessel: string, wert: string) =>
  k.db.prepare('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert').run(schluessel, wert);

/** App-ID: aus der .env – sonst eine vorgeschlagene, die beim ersten Mal entsteht und bleibt */
export function teamsAppId(k: Kontext): { id: string; ausEnv: boolean } {
  if (k.cfg.teamsAppId) return { id: k.cfg.teamsAppId, ausEnv: true };
  let id = lies(k, 'teams_app_id');
  if (!id || !GUID.test(id)) {
    id = randomUUID();
    schreibe(k, 'teams_app_id', id);
  }
  return { id, ausEnv: false };
}

/** Nur eigene Pfade als Ziel – kein offener Weiterleiter */
export function sicheresZiel(x: unknown): string {
  return typeof x === 'string' && /^\/[a-z0-9/-]{0,100}$/.test(x) && !x.includes('//') ? x : '/';
}

/** Link auf den Reiter der App; subEntityId trägt den Pfad im Portal */
export function teamsLink(appId: string, pfad: string): string {
  const kontext = JSON.stringify({ subEntityId: sicheresZiel(pfad) });
  return `https://teams.microsoft.com/l/entity/${encodeURIComponent(appId)}/${REITER}?context=${encodeURIComponent(kontext)}`;
}

/** Inhalt einer Meldung im Aktivitätsfeed: nur Texte ohne Namen und ohne Inhalte, mehrere zusammengefasst */
export function aktivitaet(appId: string, texte: string[], pfad: string) {
  const vorschau = texte.length === 1 ? texte[0] : `${texte.length} Neuigkeiten im Ausbildungsportal`;
  return {
    topic: { source: 'text', value: 'Ausbildungsportal', webUrl: teamsLink(appId, pfad) },
    activityType: 'systemDefault',
    previewText: { content: vorschau.slice(0, 150) },
    templateParameters: [{ name: 'systemDefaultText', value: texte.join(' · ').slice(0, 200) }],
  };
}

/** Schickt eine Meldung an eine Person (Entra-Objekt-ID). Wirft bei einem Fehler. */
export async function sendeTeams(k: Kontext, oid: string, texte: string[], pfad: string): Promise<void> {
  if (!k.cfg.teamsAppId) throw new Error('Die Teams-App ist nicht eingerichtet');
  await k.graph(`/users/${encodeURIComponent(oid)}/teamwork/sendActivityNotification`, aktivitaet(k.cfg.teamsAppId, texte, pfad));
}

/** Das farbige Symbol: das App-Symbol des Portals (192 × 192) */
function farbSymbol(): Buffer {
  for (const ort of ['../dist/icon-192.png', '../public/icon-192.png']) {
    const pfad = fileURLToPath(new URL(ort, import.meta.url));
    if (existsSync(pfad)) return readFileSync(pfad);
  }
  throw new Error('Das Symbol icon-192.png fehlt');
}

/** Manifest der App; die Version kommt dazu, sobald sich etwas am Paket ändert */
export function manifest(k: Kontext, appId: string, version: string): Record<string, unknown> {
  if (!k.cfg.entra) throw new Error('Ohne Anmeldung mit Microsoft gibt es keine Teams-App');
  const url = k.cfg.appUrl;
  const betrieb = leseBetrieb(k.db).name.trim();
  return {
    $schema: `https://developer.microsoft.com/json-schemas/teams/v${MANIFEST_VERSION}/MicrosoftTeams.schema.json`,
    manifestVersion: MANIFEST_VERSION,
    version,
    id: appId,
    developer: { name: (betrieb || 'Ausbildungsportal').slice(0, 32), websiteUrl: url, privacyUrl: `${url}/handbuch`, termsOfUseUrl: `${url}/handbuch` },
    name: { short: 'Ausbildungsportal', full: betrieb ? `Ausbildungsportal ${betrieb}`.slice(0, 100) : 'Ausbildungsportal' },
    description: {
      short: 'Neuigkeiten aus dem Ausbildungsportal',
      full: 'Benachrichtigungen aus dem Ausbildungsportal – Berichtsheft, Urlaub, Ausbildungsplan und Rückmeldungen. Welche du bekommst, stellst du im Portal unter „Konto“ ein. Ein Klick führt zur passenden Seite.',
    },
    icons: { color: 'color.png', outline: 'outline.png' },
    accentColor: AKZENT,
    staticTabs: [{ entityId: REITER, name: 'Ausbildungsportal', contentUrl: `${url}/teams/app?ziel={subEntityId}`, websiteUrl: url, scopes: ['personal'] }],
    validDomains: [new URL(url).host],
    // nötig für Meldungen im Aktivitätsfeed: dieselbe App-Registrierung wie die Anmeldung
    webApplicationInfo: { id: k.cfg.entra.clientId },
    showLoadingIndicator: false,
  };
}

/**
 * Das App-Paket als ZIP. Die Version steigt von selbst, wenn sich am Inhalt etwas geändert hat (Adresse, Name des Betriebs, Symbole) –
 * Teams nimmt ein neues Paket nur mit höherer Version an.
 */
export function teamsPaket(k: Kontext): { name: string; inhalt: Buffer; version: string } {
  const { id } = teamsAppId(k);
  const farbig = farbSymbol();
  const umriss = umrissSymbol(32);
  const fingerabdruck = createHash('sha256').update(JSON.stringify(manifest(k, id, '0'))).update(farbig).update(umriss).digest('hex');
  const bisher = JSON.parse(lies(k, 'teams_paket') ?? 'null') as { stand: number; fingerabdruck: string } | null;
  const stand = !bisher ? 1 : bisher.fingerabdruck === fingerabdruck ? bisher.stand : bisher.stand + 1;
  if (!bisher || stand !== bisher.stand) schreibe(k, 'teams_paket', JSON.stringify({ stand, fingerabdruck }));
  const version = `1.0.${stand}`;
  const inhalt = baueZip([
    { name: 'manifest.json', daten: JSON.stringify(manifest(k, id, version), null, 2) },
    { name: 'color.png', daten: farbig },
    { name: 'outline.png', daten: umriss },
  ]);
  return { name: `ausbildungsportal-teams-${version}.zip`, inhalt, version };
}

/** Was „Erscheinungsbild“ → „Teams-App“ zeigt */
function stand(k: Kontext) {
  const entra = k.cfg.entra !== null;
  const app = entra ? teamsAppId(k) : null;
  const paket = JSON.parse(lies(k, 'teams_paket') ?? 'null') as { stand: number } | null;
  return {
    entra,
    appId: app?.id ?? null,
    ausEnv: app?.ausEnv ?? false,
    aktiv: Boolean(k.cfg.teamsAppId),
    version: paket ? `1.0.${paket.stand}` : null,
    clientId: k.cfg.entra?.clientId ?? null,
  };
}

const ADMIN: Route['wer'] = ['admin'];

export const TEAMS_ROUTEN: Route[] = [
  { m: 'GET', p: '/api/teams', wer: ADMIN, h: (c) => ({ status: 200, body: stand(c.k) }) },
  {
    m: 'GET',
    p: '/api/teams/paket',
    wer: ADMIN,
    h: (c) => {
      if (!c.k.cfg.entra) return { status: 409, body: { fehler: 'Für die Teams-App muss die Anmeldung mit Microsoft eingerichtet sein (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET).' } };
      const p = teamsPaket(c.k);
      protokolliere(c.k.db, c.k.jetzt(), 'konto', 'teams_paket', c.b, null, `Version ${p.version}`);
      return { status: 200, datei: { typ: 'application/zip', inhalt: p.inhalt, dateiname: p.name } };
    },
  },
];

const ZEICHEN: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (z) => ZEICHEN[z]);

const STIL = `body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f7fb;color:#1f2433}
main{max-width:28rem;padding:2rem 16px;text-align:center}
h1{font-size:1.4rem;margin:0 0 .5rem}
p{margin:.5rem 0;color:#4b5263}
a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:1rem;padding:0 1.2rem;border-radius:10px;background:#4338ca;color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:3px solid #1f2433;outline-offset:3px}
@media (prefers-color-scheme:dark){body{background:#14161f;color:#e8eaf2}p{color:#b3b8c7}a{background:#a5b4fc;color:#14161f}a:focus-visible{outline-color:#e8eaf2}}`;
const STIL_HASH = createHash('sha256').update(STIL).digest('base64');

/** Wer den Reiter einbetten darf: Teams im Browser, am PC und am Handy (auch über Microsoft 365) */
export const TEAMS_EINBETTEN = "frame-ancestors https://teams.microsoft.com https://*.teams.microsoft.com https://teams.cloud.microsoft https://*.cloud.microsoft https://*.office.com https://*.microsoft365.com";

/**
 * Inhalt des Reiters in Teams: ein Hinweis und der Knopf „Im Browser öffnen“, der direkt zur passenden Seite führt.
 * Ohne Skript, ohne Anmeldung, ohne Daten – deshalb darf nur diese Seite in Teams eingebettet werden.
 */
export function teamsReiter(k: Kontext, ziel: unknown): { html: string; csp: string } {
  const pfad = sicheresZiel(ziel);
  const neu = pfad !== '/' || ziel === '/';
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ausbildungsportal</title>
<style>${STIL}</style>
</head>
<body>
<main>
<h1>Ausbildungsportal</h1>
<p>${neu ? 'Es gibt Neues für dich im Ausbildungsportal.' : 'Hier kommen deine Benachrichtigungen aus dem Ausbildungsportal an.'}</p>
<p>Das Portal öffnet sich in deinem Browser.</p>
<a href="${esc(k.cfg.appUrl + pfad)}" target="_blank" rel="noopener">Im Browser öffnen</a>
</main>
</body>
</html>`;
  return { html, csp: `default-src 'none'; style-src 'sha256-${STIL_HASH}'; base-uri 'none'; form-action 'none'; ${TEAMS_EINBETTEN}` };
}
