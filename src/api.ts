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

// ---------- Stammdaten und Azubi-Profil ----------

export interface Beruf {
  id: number;
  bezeichnung: string;
  fachrichtung: string;
  regeldauer_monate: number;
}

export interface Berufsschule {
  id: number;
  name: string;
  ort: string;
  bundesland: string;
  form: 'block' | 'teilzeit';
}

export interface Stammdaten {
  betrieb: { name: string; anschrift: string; bundesland: string };
  berufe: Beruf[];
  berufsschulen: Berufsschule[];
  bundeslaender: { kuerzel: string; name: string }[];
  ausbilder: { id: number; anzeigename: string }[];
}

export interface Profil {
  berufId: number | null;
  berufsschuleId: number | null;
  ausbilderId: number | null;
  ausbildungsbeginn: string;
  vertragsende: string;
  verkuerzungMonate: number;
  verkuerzungArt: 'ende' | 'anfang';
  verkuerzungGrund: string;
  vorzeitigeZulassung: boolean;
  wochenstunden: number;
}

export interface Stand {
  phase: 'offen' | 'vor' | 'laufend' | 'beendet';
  ausbildungsjahr: number | null;
  beginn: string | null;
  ende: string | null;
  monate: number | null;
  endeVonHand: boolean;
  tage: number | null;
}

export interface ProfilAntwort {
  azubi: { id: number; anzeigename: string; anmeldename: string; status: string };
  profil: Profil;
  beruf: Beruf | null;
  berufsschule: Berufsschule | null;
  ausbilder: { id: number; anzeigename: string } | null;
  stand: Stand;
  hoechsteVerkuerzung: number;
  bearbeitbar: boolean;
}

export interface AzubiKurz {
  id: number;
  anzeigename: string;
  anmeldename: string;
  status: string;
  beruf: string;
  phase: Stand['phase'];
  ausbildungsjahr: number | null;
  beginn: string | null;
  ende: string | null;
  tage: number | null;
}

export interface ZuweisungZeile {
  id?: number;
  beauftragter_id: number;
  beauftragter?: string;
  von: string | null;
  bis: string | null;
}

/** JJJJ-MM-TT → TT.MM.JJJJ */
export function datum(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '–';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

export function berufName(b: Pick<Beruf, 'bezeichnung' | 'fachrichtung'> | null | undefined): string {
  return b ? [b.bezeichnung, b.fachrichtung].filter(Boolean).join(' – ') : '';
}

/** Kurztext zum Stand der Ausbildung, z. B. „2. Ausbildungsjahr · bis 31.07.2028“. */
export function standText(s: Pick<Stand, 'phase' | 'ausbildungsjahr' | 'beginn' | 'ende' | 'tage'>): string {
  if (s.phase === 'offen') return 'Ausbildungsbeginn noch nicht eingetragen';
  if (s.phase === 'vor') return s.tage != null ? `beginnt in ${s.tage} Tagen (${datum(s.beginn)})` : `beginnt am ${datum(s.beginn)}`;
  if (s.phase === 'beendet') return `beendet am ${datum(s.ende)}`;
  return `${s.ausbildungsjahr}. Ausbildungsjahr · bis ${datum(s.ende)}`;
}

// ---------- Berichtsheft ----------

export type BerichtStatus = 'fehlt' | 'entwurf' | 'eingereicht' | 'zurueck' | 'abgezeichnet';
export type Grund = 'urlaub' | 'krank' | 'feiertag' | 'sonstiges';

export interface BerichtEintrag {
  text: string;
  stunden: number;
}
export interface BerichtAbwesenheit {
  tag: string;
  grund: Grund;
  stunden: number;
  text: string;
}
export interface BerichtInhalt {
  betrieb: BerichtEintrag[];
  unterweisung: BerichtEintrag[];
  schule: BerichtEintrag[];
  abwesenheit: BerichtAbwesenheit[];
}

export interface Bericht {
  montag: string;
  sonntag: string;
  kw: number;
  jahr: number;
  ausbildungsjahr: number | null;
  status: BerichtStatus;
  inhalt: BerichtInhalt;
  summe: { betrieb: number; unterweisung: number; schule: number; abwesenheit: number; gesamt: number };
  soll: number;
  kommentar: string;
  eingereichtAm: string | null;
  abgezeichnetAm: string | null;
  signaturen: { art: 'azubi' | 'abzeichnung'; name: string; rolle: Rolle; pfad: string; zeit: string }[];
  verlauf: { zeit: string; aktion: string; name: string; rolle: Rolle; kommentar: string }[];
  kopf: { azubi: string; beruf: string; betrieb: string; ausbilder: string };
  rechte: { schreiben: boolean; einreichen: boolean; zurueckziehen: boolean; loeschen: boolean; abzeichnen: boolean; oeffnen: boolean };
}

export interface WocheKurz {
  montag: string;
  sonntag: string;
  kw: number;
  jahr: number;
  ausbildungsjahr: number | null;
  status: BerichtStatus;
  stunden: number;
}

export interface BerichtListe {
  azubi: { id: number; anzeigename: string };
  eigenes: boolean;
  beginnFehlt: boolean;
  soll: number;
  wochen: WocheKurz[];
  berichte?: Bericht[];
}

export interface OffenerBericht {
  azubiId: number;
  azubi: string;
  montag: string;
  sonntag: string;
  kw: number;
  jahr: number;
  eingereichtAm: string | null;
  stunden: number;
}

export const STATUS_TEXT: Record<BerichtStatus, string> = {
  fehlt: 'fehlt',
  entwurf: 'Entwurf',
  eingereicht: 'eingereicht',
  zurueck: 'zurückgegeben',
  abgezeichnet: 'abgezeichnet',
};

export const STATUS_FARBE: Record<BerichtStatus, string> = {
  fehlt: 'rot',
  entwurf: 'grau',
  eingereicht: 'blau',
  zurueck: 'gelb',
  abgezeichnet: 'gruen',
};

export const GRUND_TEXT: Record<Grund, string> = { urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', sonstiges: 'Sonstiges' };

/** Stunden mit Komma: 7,5 statt 7.5 */
export function h(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** „02.11.–08.11.2026“ */
export function wocheText(montag: string, sonntag: string): string {
  return `${montag.slice(8, 10)}.${montag.slice(5, 7)}.–${datum(sonntag)}`;
}

/** Adresse des Berichtshefts: das eigene oder das eines betreuten Azubis. */
export function berichtsheftPfad(azubiId: number, eigenes: boolean): string {
  return eigenes ? '/berichtsheft' : `/azubis/${azubiId}/berichtsheft`;
}
