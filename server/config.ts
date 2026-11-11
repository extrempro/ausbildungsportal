import { resolve } from 'node:path';
import { istMailAdresse } from './smtp';
import type { SmtpEinstellung } from './smtp';

export interface EntraEinstellung {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  /** Ordner mit gepflegten Inhalten, z. B. Schulferien je Bundesland */
  contentDir: string;
  /** Ordner mit Lerninhalten: ein Unterordner je Inhaltspaket (Format des FISI-Lernkompass) */
  lernDir: string;
  production: boolean;
  /** Adresse, unter der die Nutzer die App im Browser sehen (ohne Schrägstrich am Ende) */
  appUrl: string;
  /** Cookies nur über HTTPS – ergibt sich aus APP_URL */
  sicher: boolean;
  /** X-Forwarded-For des Reverse Proxys für die Client-IP verwenden */
  trustProxy: boolean;
  entra: EntraEinstellung | null;
  /** Anmeldung als Testkonto ohne Entra – nie in Produktion */
  devAnmeldung: boolean;
  /** Adresse eines Teams-Workflows (Webhook), der bei jeder neuen Fehlermeldung benachrichtigt wird */
  fehlerWebhook: string | null;
  /** auch den Text der Meldung an Teams schicken (sonst nur: dass eine Meldung da ist) */
  fehlerWebhookMitText: boolean;
  /** Mailserver für die Mail an die Personalstelle (Urlaub); null = kein Mailversand */
  smtp: SmtpEinstellung | null;
  adminBenutzer: string;
  adminPasswort: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): Config {
  const production = env.NODE_ENV === 'production' || argv.includes('--production');
  const port = Number(env.PORT) || 3000;
  const appUrl = (env.APP_URL || `http://localhost:${port}`).trim().replace(/\/+$/, '');
  const url = new URL(appUrl); // wirft bei ungültiger APP_URL
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_URL darf nur Schema, Host und Port enthalten, z. B. https://ausbildung.firma.de');
  }

  let entra: EntraEinstellung | null = null;
  const tenantId = (env.ENTRA_TENANT_ID || '').trim();
  const clientId = (env.ENTRA_CLIENT_ID || '').trim();
  const clientSecret = (env.ENTRA_CLIENT_SECRET || '').trim();
  if (tenantId || clientId || clientSecret) {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Für die Entra-Anmeldung müssen ENTRA_TENANT_ID, ENTRA_CLIENT_ID und ENTRA_CLIENT_SECRET gesetzt sein');
    }
    if (!GUID.test(tenantId)) {
      throw new Error('ENTRA_TENANT_ID muss die Verzeichnis-ID (GUID) sein, nicht der Domänenname');
    }
    entra = { tenantId: tenantId.toLowerCase(), clientId, clientSecret };
  }

  const fehlerWebhook = (env.FEHLER_WEBHOOK_URL || '').trim() || null;
  if (fehlerWebhook) {
    let ziel: URL | null = null;
    try {
      ziel = new URL(fehlerWebhook);
    } catch {
      // unten gemeldet
    }
    if (!ziel || ziel.protocol !== 'https:') throw new Error('FEHLER_WEBHOOK_URL muss eine vollständige https-Adresse sein');
  }

  let smtp: SmtpEinstellung | null = null;
  const smtpHost = (env.SMTP_HOST || '').trim();
  if (smtpHost) {
    const sicherheit = (env.SMTP_SICHERHEIT || 'starttls').trim().toLowerCase();
    if (sicherheit !== 'starttls' && sicherheit !== 'tls' && sicherheit !== 'keine') throw new Error('SMTP_SICHERHEIT muss starttls, tls oder keine sein');
    const smtpPort = env.SMTP_PORT ? Number(env.SMTP_PORT) : sicherheit === 'tls' ? 465 : sicherheit === 'keine' ? 25 : 587;
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT ist keine gültige Portnummer');
    const absender = (env.SMTP_ABSENDER || '').trim();
    if (!istMailAdresse(absender)) throw new Error('SMTP_ABSENDER muss eine Mail-Adresse sein, z. B. ausbildungsportal@firma.de');
    const benutzer = (env.SMTP_BENUTZER || '').trim();
    const passwort = env.SMTP_PASSWORT || '';
    if (!!benutzer !== !!passwort) throw new Error('SMTP_BENUTZER und SMTP_PASSWORT gehören zusammen – beide setzen oder beide leer lassen');
    if (benutzer && sicherheit === 'keine') throw new Error('Mit SMTP_SICHERHEIT=keine ist keine Anmeldung möglich – das Passwort ginge unverschlüsselt über das Netz');
    if (/[\s<>]/.test(smtpHost)) throw new Error('SMTP_HOST ist kein gültiger Servername');
    smtp = { host: smtpHost, port: smtpPort, sicherheit, benutzer, passwort, absender };
  }

  return {
    port,
    host: env.HOST || '0.0.0.0',
    dataDir: resolve(env.DATA_DIR || './data'),
    contentDir: resolve(env.CONTENT_DIR || './content'),
    lernDir: resolve(env.LERN_DIR || './lerninhalte'),
    production,
    appUrl,
    sicher: url.protocol === 'https:',
    trustProxy: env.TRUST_PROXY === 'true',
    entra,
    devAnmeldung: !production && env.DEV_ANMELDUNG === 'true',
    fehlerWebhook,
    fehlerWebhookMitText: env.FEHLER_WEBHOOK_MIT_TEXT === 'true',
    smtp,
    adminBenutzer: (env.ADMIN_BENUTZER || '').trim().toLowerCase(),
    adminPasswort: env.ADMIN_PASSWORT || '',
  };
}
