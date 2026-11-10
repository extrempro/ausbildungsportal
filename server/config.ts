import { resolve } from 'node:path';

export interface EntraEinstellung {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface Config {
  port: number;
  host: string;
  dataDir: string;
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

  return {
    port,
    host: env.HOST || '0.0.0.0',
    dataDir: resolve(env.DATA_DIR || './data'),
    production,
    appUrl,
    sicher: url.protocol === 'https:',
    trustProxy: env.TRUST_PROXY === 'true',
    entra,
    devAnmeldung: !production && env.DEV_ANMELDUNG === 'true',
    adminBenutzer: (env.ADMIN_BENUTZER || '').trim().toLowerCase(),
    adminPasswort: env.ADMIN_PASSWORT || '',
  };
}
