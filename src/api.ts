export type Rolle = 'admin' | 'ausbilder' | 'beauftragter' | 'azubi';
export type Theme = 'auto' | 'light' | 'dark';

export interface Konto {
  id: number;
  anmeldung: 'entra' | 'lokal';
  anmeldename: string;
  anzeigename: string;
  rolle: Rolle;
  status: 'aktiv' | 'gesperrt';
  verknuepft: boolean;
  passwortWechsel: boolean;
  theme: Theme;
  erstellt: string;
  letzteAnmeldung: string | null;
  verwaltbar?: boolean;
  loeschbar?: boolean;
}

export interface ProtokollEintrag {
  id: number;
  zeit: string;
  aktion: string;
  benutzer_name: string;
  ziel_name: string;
  detail: string;
}

export const ROLLE_TEXT: Record<Rolle, string> = {
  admin: 'Super-Admin',
  ausbilder: 'Ausbilder',
  beauftragter: 'Ausbildungsbeauftragte',
  azubi: 'Azubi',
};

export class ApiFehler extends Error {
  constructor(
    public status: number,
    text: string,
    public code = '',
  ) {
    super(text);
  }
}

/** Wird gerufen, wenn die Sitzung abgelaufen ist – die App zeigt dann wieder die Anmeldung. */
let beiAbmeldung: () => void = () => {};
export function setzeAbmeldung(fn: () => void): void {
  beiAbmeldung = fn;
}

export async function api<T>(methode: string, pfad: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(pfad, {
      method: methode,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFehler(0, 'Der Server ist nicht erreichbar');
  }
  const daten = (await r.json().catch(() => ({}))) as { fehler?: string; code?: string };
  if (!r.ok) {
    if (r.status === 401 && daten.code === 'anmeldung') beiAbmeldung();
    throw new ApiFehler(r.status, daten.fehler ?? `Fehler ${r.status}`, daten.code);
  }
  return daten as T;
}

export function zeit(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}
