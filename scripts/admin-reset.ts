import { wechsleZumBesitzer } from '../server/benutzer-wechsel';
import { loadConfig } from '../server/config';
import { openDatabase } from '../server/db';
import { hashePasswort, zufallsPasswort } from '../server/passwort';
import { protokolliere } from '../server/protokoll';
import type { BenutzerZeile } from '../server/typen';

/**
 * Notfall: setzt das Passwort eines Super-Admins neu, hebt Sperre und Wartezeit auf und beendet seine Sitzungen.
 * Aufruf: npm run admin-reset [benutzername]   (in Docker: docker compose exec app npm run admin-reset)
 */
const cfg = loadConfig();
wechsleZumBesitzer(cfg.dataDir);
const db = await openDatabase(cfg.dataDir);
const name = (process.argv[2] ?? '').trim().toLowerCase();
const admins = db.prepare("SELECT * FROM benutzer WHERE rolle = 'admin' ORDER BY id").all() as unknown as BenutzerZeile[];
const ziel = name ? admins.find((a) => a.anmeldename === name) : admins.length === 1 ? admins[0] : undefined;

if (!ziel) {
  console.error(
    admins.length
      ? `Bitte den Benutzernamen angeben. Super-Admins: ${admins.map((a) => a.anmeldename).join(', ')}`
      : 'Es gibt noch keinen Super-Admin – er wird beim ersten Start der App angelegt.',
  );
  process.exit(1);
}

const passwort = zufallsPasswort();
db.prepare("UPDATE benutzer SET passwort_hash = ?, passwort_wechsel = 1, status = 'aktiv', fehlversuche = 0, gesperrt_bis = NULL WHERE id = ?").run(
  await hashePasswort(passwort),
  ziel.id,
);
db.prepare('DELETE FROM sitzung WHERE benutzer_id = ?').run(ziel.id);
protokolliere(db, new Date(), 'konto', 'passwort_zurueckgesetzt', null, ziel, 'über die Kommandozeile');
console.log(`Neues Startpasswort für „${ziel.anmeldename}“: ${passwort}`);
console.log('Bei der nächsten Anmeldung muss es geändert werden.');
db.close();
