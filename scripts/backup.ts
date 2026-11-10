import { wechsleZumBesitzer } from '../server/benutzer-wechsel';
import { loadConfig } from '../server/config';
import { backupDatabase, openDatabase } from '../server/db';

/** Sicherung der Datenbank nach data/backups – funktioniert auch im laufenden Betrieb. */
const cfg = loadConfig();
wechsleZumBesitzer(cfg.dataDir);
const db = await openDatabase(cfg.dataDir, () => {});
console.log(`Sicherung angelegt: ${await backupDatabase(db, cfg.dataDir, 'manuell')}`);
db.close();
