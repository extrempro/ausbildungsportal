import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ersterStart } from './api';
import type { Kontext } from './api';
import type { Config } from './config';
import type { DB } from './db';
import { entraAussteller, erzeugeEntra } from './entra';
import type { Entra } from './entra';
import { hashePasswort, zufallsPasswort } from './passwort';

export const REDIRECT_PFAD = '/api/auth/entra/callback';

export function appVersion(): string {
  const datei = fileURLToPath(new URL('../package.json', import.meta.url));
  return String((JSON.parse(readFileSync(datei, 'utf8')) as { version?: string }).version ?? '0.0.0');
}

/** Baut den Kontext, den die API braucht, und legt beim ersten Start den Super-Admin an. */
export async function erzeugeKontext(
  db: DB,
  cfg: Config,
  optionen: { log?: (t: string) => void; jetzt?: () => Date; entra?: Entra | null } = {},
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
            })
        : null;
  const k: Kontext = {
    db,
    cfg,
    entra,
    version: appVersion(),
    log: optionen.log ?? console.log,
    jetzt,
    dummyHash: await hashePasswort(zufallsPasswort()),
    versuche: new Map(),
  };
  await ersterStart(k);
  return k;
}
