/**
 * Zugriff auf das eingebaute SQLite-Modul von Node.js.
 *
 * Geladen über require statt über `import … from 'node:sqlite'`: Manche Werkzeuge (z. B. Vite)
 * kennen `node:sqlite` noch nicht als eingebautes Modul und suchen stattdessen ein npm-Paket
 * „sqlite“. Über require lädt Node das Modul direkt – in den Tests genauso wie im Betrieb.
 */
import { createRequire } from 'node:module';
import type * as NodeSqlite from 'node:sqlite';

const sqlite = createRequire(import.meta.url)('node:sqlite') as typeof NodeSqlite;

export const DatabaseSync = sqlite.DatabaseSync;
export type DatabaseSync = NodeSqlite.DatabaseSync;
export const backup = sqlite.backup;
