import { fileURLToPath } from 'node:url';
import { wechsleZumBesitzer } from './benutzer-wechsel';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { erzeugeServer } from './http';
import { raeumeAuf } from './sitzung';
import { erzeugeKontext, REDIRECT_PFAD } from './start';
import { lernpakete } from './lernen';
import { verschickeFaellige } from './benachrichtigung';

const cfg = loadConfig();
wechsleZumBesitzer(cfg.dataDir);
const db = await openDatabase(cfg.dataDir);
const k = await erzeugeKontext(db, cfg);

if (cfg.production && !cfg.sicher && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(cfg.appUrl)) {
  console.warn('WARNUNG: APP_URL beginnt nicht mit https:// – Sitzungs-Cookies gehen unverschlüsselt über das Netz.');
}
console.log(
  cfg.entra
    ? `Microsoft-Anmeldung aktiv. Umleitungs-URI für Entra: ${cfg.appUrl}${REDIRECT_PFAD}`
    : 'Microsoft-Anmeldung nicht eingerichtet (ENTRA_* fehlen) – nur der Super-Admin kann sich anmelden.',
);
if (cfg.devAnmeldung) console.warn('WARNUNG: DEV_ANMELDUNG ist an – Anmeldung als Testkonto ohne Passwort möglich.');

setInterval(() => raeumeAuf(db, new Date()), 60 * 60 * 1000).unref();
// Benachrichtigungen per Teams und E-Mail: jede Minute verschicken, was lange genug gesammelt wurde
setInterval(() => void verschickeFaellige(k).catch(() => k.log('Benachrichtigungen konnten nicht verschickt werden')), 60 * 1000).unref();

const server = erzeugeServer(k, fileURLToPath(new URL('../dist', import.meta.url)));
server.listen(cfg.port, cfg.host, () => {
  console.log(`Ausbildungsportal ${k.version} gestartet. Adresse im Browser laut APP_URL: ${cfg.appUrl}`);
  console.log(`Anmeldung des Super-Admins: ${cfg.appUrl.replace(/\/$/, '')}/super`);
  // In Docker ist das immer der Port im Container – welcher Port außen gilt, bestimmt die Compose-Datei.
  console.log(`Lauscht auf ${cfg.host}:${cfg.port} (mit Docker ist das der Port im Container; den Port außen zeigt: docker compose ps)`);
  // Lernmodul: gleich beim Start einlesen, damit Fehler in den Inhalten und ein leerer Ordner im Log stehen
  if (lernpakete(k).size === 0) console.log(`Lernmodul: keine Lerninhalte gefunden in ${cfg.lernDir} – Einrichtung siehe lerninhalte/README.md`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
