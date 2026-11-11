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
  /** Ausbilder mit Gesamtsicht: sieht und bearbeitet alle Azubis */
  alleAzubis: boolean;
  /** Adresse des Profilbilds aus Microsoft oder null */
  bild: string | null;
  /** will die Person ihr Profilbild zeigen? */
  bildZeigen: boolean;
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
    /** was der Server sonst noch mitgeschickt hat (z. B. die Fehlerliste eines Inhaltspakets) */
    public daten: Record<string, unknown> = {},
  ) {
    super(text);
  }
}

/** Wird gerufen, wenn die Sitzung abgelaufen ist – die App zeigt dann wieder die Anmeldung. */
let beiAbmeldung: () => void = () => {};
export function setzeAbmeldung(fn: () => void): void {
  beiAbmeldung = fn;
}

/**
 * Neue Version: Der Server nennt in jeder Antwort seine Version. Weicht sie von der dieser Oberfläche ab,
 * wurde das Portal aktualisiert, während die Seite offen war – dann bittet ein Hinweis um Neuladen.
 */
let serverVersion: string | null = null;
let spaeterBis = 0;
const versionsHoerer = new Set<() => void>();
const SPAETER_MS = 10 * 60 * 1000;
function pruefeVersion(v: string | null): void {
  const neu = v && v !== __APP_VERSION__ && Date.now() >= spaeterBis ? v : null;
  if (neu === serverVersion) return;
  serverVersion = neu;
  versionsHoerer.forEach((h) => h());
}
export const neueVersion = {
  abonniere: (h: () => void) => {
    versionsHoerer.add(h);
    return () => versionsHoerer.delete(h);
  },
  /** Version des Servers, wenn sie von der geladenen Oberfläche abweicht – sonst null */
  lies: () => serverVersion,
  /** „Später“: Der Hinweis verschwindet und kommt nach zehn Minuten wieder */
  spaeter: () => {
    spaeterBis = Date.now() + SPAETER_MS;
    pruefeVersion(null);
  },
};

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
  pruefeVersion(r.headers.get('X-App-Version'));
  const daten = (await r.json().catch(() => ({}))) as { fehler?: string; code?: string };
  if (!r.ok) {
    if (r.status === 401 && daten.code === 'anmeldung') beiAbmeldung();
    throw new ApiFehler(r.status, daten.fehler ?? `Fehler ${r.status}`, daten.code);
  }
  return daten as T;
}

/**
 * Lädt eine Datei vom Server (z. B. das Berichtsheft als PDF) und übergibt sie dem Browser zum Speichern.
 * Den Dateinamen nennt der Server. Fehler kommen wie bei `api` als ApiFehler.
 */
export async function ladeDatei(pfad: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(pfad, { credentials: 'same-origin' });
  } catch {
    throw new ApiFehler(0, 'Der Server ist nicht erreichbar');
  }
  if (!r.ok) {
    const daten = (await r.json().catch(() => ({}))) as { fehler?: string; code?: string };
    if (r.status === 401 && daten.code === 'anmeldung') beiAbmeldung();
    throw new ApiFehler(r.status, daten.fehler ?? `Fehler ${r.status}`, daten.code);
  }
  const angabe = r.headers.get('Content-Disposition') ?? '';
  const voll = /filename\*=UTF-8''([^;]+)/i.exec(angabe)?.[1];
  const name = voll ? decodeURIComponent(voll) : (/filename="([^"]+)"/i.exec(angabe)?.[1] ?? 'download');
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // der Browser braucht die Adresse noch einen Augenblick, um die Datei abzuholen
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Lädt eine Datei zum Server hoch (der Körper ist die Datei selbst) und gibt die Antwort als JSON zurück. */
export async function ladeHoch<T>(pfad: string, datei: Blob, typ: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(pfad, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': typ }, body: datei });
  } catch {
    throw new ApiFehler(0, 'Der Server ist nicht erreichbar');
  }
  pruefeVersion(r.headers.get('X-App-Version'));
  const daten = (await r.json().catch(() => ({}))) as { fehler?: string; code?: string };
  if (!r.ok) {
    if (r.status === 401 && daten.code === 'anmeldung') beiAbmeldung();
    throw new ApiFehler(r.status, daten.fehler ?? (r.status === 413 ? 'Die Datei ist zu groß' : `Fehler ${r.status}`), daten.code, daten as Record<string, unknown>);
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
  /** Inhaltspaket des Lernmoduls oder null (aus) */
  lernpaket: string | null;
}

export interface Berufsschule {
  id: number;
  name: string;
  ort: string;
  bundesland: string;
  form: 'block' | 'teilzeit';
}

export interface Stammdaten {
  betrieb: { name: string; anschrift: string; bundesland: string; personalMail: string };
  /** ist im Portal ein Mailserver eingerichtet? */
  mailversand: boolean;
  berufe: Beruf[];
  berufsschulen: Berufsschule[];
  bundeslaender: { kuerzel: string; name: string }[];
  ausbilder: { id: number; anzeigename: string }[];
  /** Inhaltspakete, die sich an einem Beruf als Lernmodul einschalten lassen */
  lernpakete: { id: string; titel: string; stand: string; themenfelder: number; unterthemen: number; fehler: number; meldungen: string[] }[];
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
  /** Urlaubsanspruch in Arbeitstagen je Kalenderjahr – null, solange nichts eingetragen ist */
  urlaubstage: number | null;
  pruefungen: Pruefung[];
}

export interface Pruefung {
  bezeichnung: string;
  datum: string;
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

/**
 * Wie ein Ausbilder zu einem Azubi steht: eigen = zuständig, ohne = niemand zuständig (alle Ausbilder sehen ihn),
 * gesamt = sichtbar über die Gesamtsicht, vertretung = für einen Zeitraum zugewiesen. Für andere Rollen null.
 */
export type Betreuung = 'eigen' | 'ohne' | 'gesamt' | 'vertretung' | null;

export interface ProfilAntwort {
  azubi: { id: number; anzeigename: string; anmeldename: string; status: string };
  profil: Profil;
  beruf: Beruf | null;
  berufsschule: Berufsschule | null;
  ausbilder: { id: number; anzeigename: string } | null;
  stand: Stand;
  hoechsteVerkuerzung: number;
  bearbeitbar: boolean;
  betreuung: Betreuung;
}

export interface AzubiKurz {
  id: number;
  bild: string | null;
  anzeigename: string;
  anmeldename: string;
  status: string;
  beruf: string;
  phase: Stand['phase'];
  ausbildungsjahr: number | null;
  beginn: string | null;
  ende: string | null;
  tage: number | null;
  /** eingereichte (wartende), zurückgegebene und für vergangene Wochen fehlende Berichte */
  berichte: { wartend: number; zurueck: number; fehlend: number };
  betreuung?: Betreuung;
}

export interface ZuweisungZeile {
  id?: number;
  beauftragter_id: number;
  beauftragter?: string;
  rolle?: Rolle;
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
  plan: { art: PlanArt; titel: string }[];
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
  bild: string | null;
  montag: string;
  sonntag: string;
  kw: number;
  jahr: number;
  eingereichtAm: string | null;
  stunden: number;
  /** Wochenstunden des Azubis */
  soll: number;
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

// ---------- Ausbildungsplan ----------

export type PlanArt = 'schule' | 'einsatz' | 'aufgabe' | 'notiz' | 'termin';
/** was Ausbilder planen (Bausteine, Sammelplanung); Termine tragen nur Azubis selbst ein – und nur sie sehen sie */
export const PLAN_ARTEN: PlanArt[] = ['schule', 'einsatz', 'aufgabe', 'notiz'];
export const ART_TEXT: Record<PlanArt, string> = { schule: 'Berufsschule', einsatz: 'Einsatz', aufgabe: 'Aufgabe', notiz: 'Notiz', termin: 'Termin' };
export const ART_FARBE: Record<PlanArt, string> = { schule: 'violett', einsatz: 'gruen', aufgabe: 'gelb', notiz: 'grau', termin: 'blau' };

export interface Unteraufgabe {
  text: string;
  erledigt: boolean;
}

export interface PlanEintrag {
  id: number;
  art: PlanArt;
  von: string;
  bis: string;
  titel: string;
  text: string;
  zustaendigId: number | null;
  zustaendig: string;
  /** Abteilung eines Einsatzes (oder null) und ihr Name */
  abteilungId: number | null;
  abteilung: string;
  erledigt: boolean;
  unteraufgaben: Unteraufgabe[];
  /** nur Termine: Tag (JJJJ-MM-TT) und freiwillige Uhrzeit (HH:MM) */
  tag: string | null;
  zeitVon: string;
  zeitBis: string;
  /** vom Azubi selbst angelegt */
  vomAzubi: boolean;
  /** das angemeldete Konto darf den Eintrag ändern und löschen */
  bearbeitbar: boolean;
}

export interface PlanWoche {
  montag: string;
  kw: number;
  jahr: number;
  ausbildungsjahr: number | null;
}

export interface PlanAntwort {
  azubi: { id: number; anzeigename: string };
  eigenes: boolean;
  heute: string;
  beginnFehlt: boolean;
  /** erster und letzter Tag der Ausbildung */
  beginn: string | null;
  ende: string | null;
  beruf: string;
  wochen: PlanWoche[];
  eintraege: PlanEintrag[];
  pruefungen: Pruefung[];
  feiertage: { datum: string; name: string }[];
  ferien: { name: string; von: string; bis: string }[];
  ferienVorhanden: boolean;
  rechte: { arten: PlanArt[]; zuweisen: boolean };
  personen: { id: number; anzeigename: string; rolle: Rolle }[];
  vorlagen: { id: number; titel: string; berufId: number | null; passt: boolean }[];
}

export interface VorlageEintrag {
  art: PlanArt;
  abWoche: number;
  wochen: number;
  titel: string;
  text: string;
  unteraufgaben: string[];
}

export interface Planvorlage {
  id: number;
  berufId: number | null;
  titel: string;
  eintraege: VorlageEintrag[];
}


export interface Versionshinweis {
  version: string;
  datum: string;
  gruppen: { titel: string; punkte: string[] }[];
}

/** JJJJ-MM-TT plus n Tage */
export function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Logo des Betriebs je Darstellung; fehlt das dunkle, gilt das helle auch dort. */
export interface Logos {
  logo: string | null;
  logoDunkel: string | null;
}

/** Was in der hellen bzw. dunklen Darstellung gezeigt wird (null = Standard-Symbol). */
export function logoFuer(l: Logos, dunkel: boolean): string | null {
  return dunkel ? (l.logoDunkel ?? l.logo) : l.logo;
}

// ---------- Urlaub ----------

export type UrlaubStatus = 'offen' | 'genehmigt' | 'abgelehnt' | 'zurueckgezogen' | 'storniert';

export interface UrlaubAntrag {
  id: number;
  azubi: { id: number; anzeigename: string };
  von: string;
  bis: string;
  /** Arbeitstage: Montag bis Freitag ohne Feiertage */
  tage: number;
  bemerkung: string;
  status: UrlaubStatus;
  hinweise: string[];
  /** wo ein offener Antrag gerade liegt */
  stufe: 'beauftragte' | 'ausbilder' | null;
  /** gruppe = Abteilung: aus ihr genügt eine Bestätigung; leer = die Person bestätigt selbst */
  bestaetigungen: { name: string; zeit: string | null; ich: boolean; gruppe: string }[];
  erstellt: string;
  verlauf: { zeit: string; aktion: string; name: string; rolle: Rolle; kommentar: string }[];
  rechte: { zurueckziehen: boolean; bestaetigen: boolean; ablehnen: boolean; genehmigen: boolean; stornieren: boolean; mailErneut: boolean };
  /** Mail an die Personalstelle – nur für den zuständigen Ausbilder, nur nach Genehmigung oder Storno */
  mail: { stand: 'offen' | 'gesendet' | 'fehler' | 'ohne'; fehler: string } | null;
  bestaetigungFehlt: string[];
}

export interface UrlaubKonto {
  jahr: number;
  anspruch: number | null;
  genehmigt: number;
  beantragt: number;
  frei: number | null;
}

/** „07.12.–11.12.2026“ oder ein einzelner Tag */
export function zeitraum(von: string, bis: string): string {
  return von === bis ? datum(von) : `${von.slice(8, 10)}.${von.slice(5, 7)}.${von.slice(0, 4) === bis.slice(0, 4) ? '' : von.slice(0, 4)}–${datum(bis)}`;
}
