import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ersterStart } from './api';
import { erzeugeGraph } from './teams';
import type { Kontext } from './api';
import type { Config } from './config';
import type { DB } from './db';
import { entraAussteller, erzeugeEntra } from './entra';
import type { Entra } from './entra';
import { hashePasswort, zufallsPasswort } from './passwort';
import { MailFehler, sendeMail } from './smtp';

/**
 * Server-Log ohne eingeschleuste Zeilen (ASVS 5.0, 16.4.1): Steuerzeichen (z. B. Farbcodes fürs Terminal) werden zu „?“,
 * jede weitere Zeile einer Meldung wird eingerückt. So kann eine Eingabe mit Zeilenumbruch keine eigene, echt aussehende
 * Log-Zeile erzeugen – Stacktraces bleiben trotzdem lesbar.
 */
export function sichererLog(ausgabe: (text: string) => void): (text: string) => void {
  return (text) => ausgabe(String(text).replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '?').replace(/\n/g, '\n    '));
}

export const REDIRECT_PFAD = '/api/auth/entra/callback';

export function appVersion(): string {
  const datei = fileURLToPath(new URL('../package.json', import.meta.url));
  return String((JSON.parse(readFileSync(datei, 'utf8')) as { version?: string }).version ?? '0.0.0');
}

/** Baut den Kontext, den die API braucht, und legt beim ersten Start den Super-Admin an. */
export async function erzeugeKontext(
  db: DB,
  cfg: Config,
  optionen: { log?: (t: string) => void; jetzt?: () => Date; entra?: Entra | null; sende?: Kontext['sende']; mail?: Kontext['mail']; graph?: Kontext['graph'] } = {},
): Promise<Kontext> {
  const jetzt = optionen.jetzt ?? (() => new Date());
  const entra =
    optionen.entra !== undefined
      ? optionen.entra
      : cfg.entra
        ? erzeugeEntra({
              aussteller: entraAussteller(cfg.entra.tenantId),
              clientId: cfg.entra.clientId,
              clientSecret: cfg.entra.clientSecret,
              redirectUri: cfg.appUrl + REDIRECT_PFAD,
              tenantId: cfg.entra.tenantId,
              profilbild: cfg.entraProfilbild,
            })
        : null;
  const k: Kontext = {
    db,
    cfg,
    entra,
    version: appVersion(),
    log: sichererLog(optionen.log ?? console.log),
    jetzt,
    dummyHash: await hashePasswort(zufallsPasswort()),
    versuche: new Map(),
    gemeldeteHerkunft: new Set(),
    mail: optionen.mail ?? ((m) => (cfg.smtp ? sendeMail(cfg.smtp, m, jetzt()) : Promise.reject(new MailFehler('Der Mailversand ist nicht eingerichtet')))),
    graph: optionen.graph ?? (cfg.entra ? erzeugeGraph(cfg.entra) : () => Promise.reject(new Error('Die Anmeldung mit Microsoft ist nicht eingerichtet'))),
    sende:
      optionen.sende ??
      (async (url, body) => {
        // Umleitungen werden nicht verfolgt, nach acht Sekunden ist Schluss – eine hängende Gegenstelle bremst das Portal nicht
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(8000) });
        return { ok: r.ok, status: r.status };
      }),
  };
  await ersterStart(k);
  return k;
}
