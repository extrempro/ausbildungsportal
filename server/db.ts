import { DatabaseSync, backup } from './sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Eingebautes SQLite von Node.js (ab 22.16) – keine native Abhängigkeit, nichts zu kompilieren. */
export type DB = DatabaseSync;

/** Führt fn in einer Transaktion aus; bei einem Fehler wird alles zurückgerollt. */
export function transaktion<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));
const DB_FILE = 'ausbildungsportal.db';

/** Wie viele Sicherungen je Art behalten werden. */
const KEEP = { migration: 10, taeglich: 7, manuell: 10, import: 10, reset: 10 } as const;
export type BackupArt = keyof typeof KEEP;

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({
      version: Number(f.slice(0, 3)),
      name: f,
      sql: readFileSync(join(dir, f), 'utf8'),
    }));
}

export function latestSchemaVersion(migrations = loadMigrations()): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0);
}

export function currentSchemaVersion(db: DB): number {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'")
    .get();
  if (!table) return 0;
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null } | undefined;
  return Number(row?.v ?? 0);
}

export function backupDir(dataDir: string): string {
  return join(dataDir, 'backups');
}

/** Sichere Kopie über die SQLite-Backup-Funktion (funktioniert auch im laufenden Betrieb). */
export async function backupDatabase(db: DB, dataDir: string, art: BackupArt, label = ''): Promise<string> {
  const dir = backupDir(dataDir);
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(dir, `ausbildungsportal-${art}${label ? `-${label}` : ''}-${stamp}.db`);
  await backup(db, file);
  pruneBackups(dataDir, art);
  return file;
}

function pruneBackups(dataDir: string, art: BackupArt): void {
  const dir = backupDir(dataDir);
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`ausbildungsportal-${art}-`) && f.endsWith('.db'))
    .sort()
    .reverse();
  for (const f of files.slice(KEEP[art])) {
    try {
      unlinkSync(join(dir, f));
    } catch {
      /* ignorieren */
    }
  }
}

export function latestBackup(dataDir: string): { datei: string; zeit: string } | null {
  const dir = backupDir(dataDir);
  if (!existsSync(dir)) return null;
  let best: { datei: string; mtime: number } | null = null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.db')) continue;
    const mtime = statSync(join(dir, f)).mtimeMs;
    if (!best || mtime > best.mtime) best = { datei: f, mtime };
  }
  return best ? { datei: best.datei, zeit: new Date(best.mtime).toISOString() } : null;
}

/**
 * Führt fehlende Migrationen in einer Transaktion aus.
 * Vorher wird (außer bei einer neuen, leeren Datenbank) eine Sicherung angelegt.
 */
export async function migrate(
  db: DB,
  dataDir: string | null,
  migrations = loadMigrations(),
  log: (msg: string) => void = console.log,
): Promise<{ von: number; nach: number }> {
  const latest = latestSchemaVersion(migrations);
  const current = currentSchemaVersion(db);

  if (current > latest) {
    throw new Error(
      `Die Datenbank hat Schema ${current}, diese App-Version kennt nur bis Schema ${latest}. ` +
        `Bitte die App aktualisieren oder eine passende Sicherung aus ${dataDir ? backupDir(dataDir) : 'dem Sicherungsordner'} verwenden.`,
    );
  }
  if (current === latest) return { von: current, nach: current };

  if (current > 0 && dataDir) {
    const file = await backupDatabase(db, dataDir, 'migration', `v${current}`);
    log(`Sicherung vor Migration angelegt: ${file}`);
  }

  const pending = migrations.filter((m) => m.version > current);
  transaktion(db, () => {
    for (const m of pending) db.exec(m.sql);
    db.exec('DELETE FROM schema_version');
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(latest);
  });
  log(current === 0 ? `Datenbank angelegt (Schema ${latest})` : `Migration ${current} → ${latest} erfolgreich`);
  return { von: current, nach: latest };
}

export async function openDatabase(dataDir: string, log: (msg: string) => void = console.log): Promise<DB> {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, DB_FILE));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  await migrate(db, dataDir, loadMigrations(), log);
  return db;
}

/** Legt höchstens einmal pro Tag eine Sicherung an. */
export async function dailyBackup(db: DB, dataDir: string): Promise<string | null> {
  const last = latestBackupOfArt(dataDir, 'taeglich');
  if (last && Date.now() - last < 23 * 60 * 60 * 1000) return null;
  return backupDatabase(db, dataDir, 'taeglich');
}

function latestBackupOfArt(dataDir: string, art: BackupArt): number | null {
  const dir = backupDir(dataDir);
  if (!existsSync(dir)) return null;
  let best: number | null = null;
  for (const f of readdirSync(dir)) {
    if (!f.startsWith(`ausbildungsportal-${art}-`)) continue;
    const m = statSync(join(dir, f)).mtimeMs;
    if (best === null || m > best) best = m;
  }
  return best;
}
