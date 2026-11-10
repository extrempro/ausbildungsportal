import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { behandle } from './api';
import type { Anfrage, Kontext } from './api';

/**
 * Webserver ohne Zusatzpakete: reicht /api an die API weiter und liefert sonst das gebaute Frontend aus.
 * Alle Pfade außerhalb von /api und den Dateien in dist liefern index.html (für die Seitenadressen der Oberfläche).
 */
const MAX_BODY = 256 * 1024;

const TYPEN: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sicherheitsHeader(k: Kontext): Record<string, string> {
  return {
    // nur eigene Quellen: keine fremden Skripte, Schriften oder Bilder, keine Einbettung in fremde Seiten
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(k.cfg.sicher ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}

function cookiesAus(header: string | undefined): Record<string, string> {
  const r: Record<string, string> = {};
  for (const teil of (header ?? '').split(';')) {
    const i = teil.indexOf('=');
    if (i > 0) r[teil.slice(0, i).trim()] = teil.slice(i + 1).trim();
  }
  return r;
}

function clientIp(k: Kontext, req: IncomingMessage): string {
  if (k.cfg.trustProxy) {
    // der letzte Eintrag stammt vom eigenen Reverse Proxy; frühere kann der Client frei erfinden
    const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress ?? '';
}

async function leseBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const typ = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const teile: Buffer[] = [];
  let groesse = 0;
  for await (const stueck of req) {
    groesse += (stueck as Buffer).length;
    if (groesse > MAX_BODY) throw new Error('zu_gross');
    teile.push(stueck as Buffer);
  }
  if (groesse === 0) return undefined;
  if (typ !== 'application/json') throw new Error('kein_json');
  return JSON.parse(Buffer.concat(teile).toString('utf8'));
}

function sende(res: ServerResponse, status: number, header: Record<string, string | string[]>, body?: string): void {
  res.writeHead(status, header);
  res.end(body);
}

async function api(k: Kontext, req: IncomingMessage, res: ServerResponse, url: URL, basis: Record<string, string>): Promise<void> {
  const kopf = { ...basis, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
  let body: unknown;
  try {
    body = await leseBody(req);
  } catch (e) {
    const zuGross = e instanceof Error && e.message === 'zu_gross';
    return sende(res, zuGross ? 413 : 400, kopf, JSON.stringify({ fehler: zuGross ? 'Anfrage zu groß' : 'Anfrage muss gültiges JSON sein' }));
  }
  const headers: Record<string, string | undefined> = {};
  for (const [name, wert] of Object.entries(req.headers)) headers[name] = Array.isArray(wert) ? wert.join(', ') : wert;
  const anfrage: Anfrage = {
    methode: req.method ?? 'GET',
    pfad: url.pathname,
    query: url.searchParams,
    headers,
    cookies: cookiesAus(req.headers.cookie),
    body,
    ip: clientIp(k, req),
  };
  const a = await behandle(k, anfrage);
  const extra: Record<string, string | string[]> = {};
  if (a.cookies?.length) extra['Set-Cookie'] = a.cookies;
  if (a.redirect) return sende(res, a.status, { ...basis, 'Cache-Control': 'no-store', Location: a.redirect, ...extra });
  sende(res, a.status, { ...kopf, ...extra }, JSON.stringify(a.body ?? {}));
}

function datei(res: ServerResponse, methode: string, pfad: string, basis: Record<string, string>, cache: string): void {
  res.writeHead(200, {
    ...basis,
    'Content-Type': TYPEN[extname(pfad).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': String(statSync(pfad).size),
    'Cache-Control': cache,
  });
  if (methode === 'HEAD') res.end();
  else createReadStream(pfad).pipe(res);
}

export function erzeugeServer(k: Kontext, distDir: string): Server {
  const wurzel = resolve(distDir);
  return createServer((req, res) => {
    const basis = sicherheitsHeader(k);
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://x');
    } catch {
      return sende(res, 400, basis, 'Ungültige Adresse');
    }
    if (url.pathname.startsWith('/api/')) {
      api(k, req, res, url, basis).catch((e) => {
        k.log(`Unerwarteter Fehler: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
        if (!res.headersSent) sende(res, 500, basis, '{"fehler":"Interner Fehler"}');
        else res.end();
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sende(res, 405, basis, 'Methode nicht erlaubt');

    let pfad: string;
    try {
      pfad = normalize(join(wurzel, decodeURIComponent(url.pathname)));
    } catch {
      return sende(res, 400, basis, 'Ungültige Adresse');
    }
    // nie aus dem dist-Ordner heraus
    const innerhalb = pfad === wurzel || pfad.startsWith(wurzel + sep);
    if (innerhalb && pfad !== wurzel && existsSync(pfad) && statSync(pfad).isFile() && !pfad.endsWith('index.html')) {
      // Dateien unter /assets tragen einen Hash im Namen und dürfen lange im Cache bleiben
      return datei(res, req.method, pfad, basis, url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    if (url.pathname.startsWith('/assets/')) return sende(res, 404, basis, 'Nicht gefunden');
    const index = join(wurzel, 'index.html');
    if (!existsSync(index)) {
      return sende(res, 503, { ...basis, 'Content-Type': 'text/plain; charset=utf-8' }, 'Die Oberfläche ist noch nicht gebaut: npm run build');
    }
    // index.html nie cachen – sonst sieht der Browser nach einem Update die alte Version
    datei(res, req.method, index, basis, 'no-store');
  });
}
