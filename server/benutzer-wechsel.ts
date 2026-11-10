import { statSync } from 'node:fs';

/**
 * Läuft der Prozess als root, der Datenordner gehört aber einem anderen Benutzer, wechselt der Prozess
 * zu diesem Benutzer. Wichtig für Befehle im Container (docker compose exec app npm run backup): Sie
 * starten als root und würden sonst Dateien anlegen, in die die App danach nicht mehr schreiben kann.
 *
 * Gehört der Datenordner root (oder gibt es ihn noch nicht), bleibt alles, wie es ist.
 */
export function wechsleZumBesitzer(dataDir: string): void {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
  const st = statSync(dataDir, { throwIfNoEntry: false });
  if (!st || st.uid === 0) return;
  process.setgroups?.([st.gid]);
  process.setgid?.(st.gid);
  process.setuid?.(st.uid);
}
