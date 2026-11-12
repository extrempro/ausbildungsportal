import { connect as netConnect } from 'node:net';
import type { Socket } from 'node:net';
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';

/**
 * Kleiner SMTP-Versand ohne fremde Bibliothek – genau für das, was das Portal braucht:
 * eine Textmail an eine Adresse, über den Mailserver des Betriebs.
 * - Sicherheit: 'starttls' (üblich auf Port 587), 'tls' (Port 465) oder 'keine' (nur für ein internes Relay ohne Anmeldung).
 * - Bei 'starttls' wird nie unverschlüsselt weitergemacht, wenn der Server STARTTLS nicht anbietet.
 * - Zugangsdaten gehen nur über eine verschlüsselte Verbindung (config.ts lehnt die Kombination mit 'keine' ab).
 * - Das Zertifikat des Servers wird geprüft. Eigene Zertifizierungsstellen: NODE_EXTRA_CA_CERTS.
 * - Fehlertexte enthalten nie das Passwort.
 */
export interface SmtpEinstellung {
  host: string;
  port: number;
  sicherheit: 'starttls' | 'tls' | 'keine';
  benutzer: string;
  passwort: string;
  /** Absender-Adresse */
  absender: string;
  /** eigene Zertifizierungsstelle (PEM) – nur für Tests */
  ca?: string;
}

export interface Mail {
  an: string;
  betreff: string;
  text: string;
  /** gestaltete Fassung; die Textfassung geht immer mit, für Mailprogramme, die kein HTML zeigen */
  html?: string;
  /** Bild, das die gestaltete Fassung als <img src="cid:…"> zeigt (Logo) */
  bild?: { cid: string; typ: string; inhalt: Buffer };
}

/** Fehler mit einem Text, der so beim Ausbilder angezeigt werden kann */
export class MailFehler extends Error {}

const ZEIT_MS = 15_000;
const ADRESSE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/;
export const istMailAdresse = (s: string): boolean => s.length <= 200 && ADRESSE.test(s);

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
/** Kopfzeilen dürfen keinen Zeilenumbruch enthalten – sonst ließen sich Kopfzeilen einschleusen */
const einzeilig = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
/** Betreff mit Umlauten: als „encoded word“, in Stücken, die in eine Zeile passen */
function kopfwort(s: string): string {
  const text = einzeilig(s);
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const teile: string[] = [];
  let stueck = '';
  for (const zeichen of text) {
    if (Buffer.byteLength(stueck + zeichen, 'utf8') > 42) {
      teile.push(stueck);
      stueck = '';
    }
    stueck += zeichen;
  }
  if (stueck) teile.push(stueck);
  return teile.map((t) => `=?UTF-8?B?${b64(t)}?=`).join('\r\n ');
}

/** Baut die Mail, wie sie nach DATA gesendet wird (ohne den abschließenden Punkt). */
export function baueMail(cfg: Pick<SmtpEinstellung, 'absender'>, mail: Mail, jetzt: Date): string {
  const domain = cfg.absender.split('@')[1] ?? 'localhost';
  const zeilen = (base64: string) => base64.match(/.{1,76}/g)!.join('\r\n');
  const teil = (typ: string, inhalt: string, weitere: string[] = []) => [`Content-Type: ${typ}`, 'Content-Transfer-Encoding: base64', ...weitere, '', zeilen(inhalt)].join('\r\n');
  const text = teil('text/plain; charset=utf-8', b64(mail.text.replace(/\r?\n/g, '\r\n')));
  const kopf = [
    `From: Ausbildungsportal <${einzeilig(cfg.absender)}>`,
    `To: <${einzeilig(mail.an)}>`,
    `Subject: ${kopfwort(mail.betreff)}`,
    `Date: ${jetzt.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];
  if (!mail.html) return [...kopf, text].join('\r\n');

  // Text und gestaltete Fassung als Alternativen; das Logo hängt an der gestalteten Fassung (multipart/related)
  const grenze = (art: string) => `=_${art}_${randomBytes(12).toString('hex')}`;
  const mehrteilig = (art: string, g: string, teile: string[], zusatz = '') => [`Content-Type: multipart/${art}; boundary="${g}"${zusatz}`, '', ...teile.map((t) => `--${g}\r\n${t}`), `--${g}--`].join('\r\n');
  let html = teil('text/html; charset=utf-8', b64(mail.html.replace(/\r?\n/g, '\r\n')));
  if (mail.bild) {
    const cid = mail.bild.cid.replace(/[^A-Za-z0-9.@_-]/g, '');
    const typ = /^image\/(png|jpeg)$/.test(mail.bild.typ) ? mail.bild.typ : 'application/octet-stream';
    html = mehrteilig('related', grenze('rel'), [html, teil(typ, mail.bild.inhalt.toString('base64'), [`Content-ID: <${cid}>`, 'Content-Disposition: inline'])], '; type="text/html"');
  }
  return [...kopf, mehrteilig('alternative', grenze('alt'), [text, html])].join('\r\n');
}

/** Liest Antworten des Servers zeilenweise; eine Antwort endet mit „250 …“ (Leerzeichen statt Bindestrich). */
class Leitung {
  private puffer = '';
  private wartend: { fertig: (a: { code: number; zeilen: string[] }) => void; fehler: (e: Error) => void } | null = null;
  private zeilen: string[] = [];
  private ende: Error | null = null;
  private readonly beiDaten = (d: Buffer) => {
    this.puffer += d.toString('utf8');
    this.verarbeite();
  };
  private readonly beiFehler = (e: Error) => this.schliesse(e);
  private readonly beiEnde = () => this.schliesse(new MailFehler('Der Mailserver hat die Verbindung beendet'));
  private readonly beiZeit = () => this.schliesse(new MailFehler('Der Mailserver antwortet nicht'));

  constructor(public socket: Socket) {
    this.haenge(socket);
  }

  private haenge(s: Socket): void {
    s.setTimeout(ZEIT_MS);
    s.on('data', this.beiDaten);
    s.on('error', this.beiFehler);
    s.on('close', this.beiEnde);
    s.on('timeout', this.beiZeit);
  }

  /** nach STARTTLS: dieselbe Leitung liest von der verschlüsselten Verbindung weiter */
  wechsle(s: Socket): void {
    for (const [name, fn] of [['data', this.beiDaten], ['error', this.beiFehler], ['close', this.beiEnde], ['timeout', this.beiZeit]] as const) this.socket.off(name, fn as () => void);
    this.puffer = '';
    this.socket = s;
    this.haenge(s);
  }

  private schliesse(e: Error): void {
    if (this.ende) return;
    this.ende = e instanceof MailFehler ? e : new MailFehler(uebersetze(e));
    this.socket.destroy();
    this.wartend?.fehler(this.ende);
    this.wartend = null;
  }

  private verarbeite(): void {
    let i: number;
    while ((i = this.puffer.indexOf('\n')) >= 0) {
      const zeile = this.puffer.slice(0, i).replace(/\r$/, '');
      this.puffer = this.puffer.slice(i + 1);
      this.zeilen.push(zeile);
      if (/^\d{3}( |$)/.test(zeile) && this.wartend) {
        const w = this.wartend;
        this.wartend = null;
        const zeilen = this.zeilen;
        this.zeilen = [];
        w.fertig({ code: Number(zeile.slice(0, 3)), zeilen });
      }
    }
    if (this.puffer.length > 100_000) this.schliesse(new MailFehler('Der Mailserver antwortet unverständlich'));
  }

  antwort(): Promise<{ code: number; zeilen: string[] }> {
    if (this.ende) return Promise.reject(this.ende);
    return new Promise((fertig, fehler) => {
      this.wartend = { fertig, fehler };
      this.verarbeite();
    });
  }

  /** sendet einen Befehl und erwartet einen der genannten Codes; `was` beschreibt den Schritt für die Fehlermeldung */
  async befehl(zeile: string | null, erwartet: number[], was: string): Promise<string[]> {
    if (zeile !== null) this.socket.write(`${zeile}\r\n`);
    const a = await this.antwort();
    if (!erwartet.includes(a.code)) {
      // die Antwort des Servers hilft bei der Suche – gekürzt und ohne Zeilenumbrüche
      const detail = a.zeilen.join(' ').replace(/\s+/g, ' ').slice(0, 160);
      throw new MailFehler(`${was}: ${detail}`);
    }
    return a.zeilen;
  }

  beende(): void {
    this.ende ??= new MailFehler('beendet');
    this.socket.destroy();
  }
}

function uebersetze(e: Error): string {
  const code = (e as NodeJS.ErrnoException).code ?? '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Der Mailserver wurde nicht gefunden (Name prüfen)';
  if (code === 'ECONNREFUSED') return 'Der Mailserver nimmt auf diesem Port keine Verbindung an';
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'Der Mailserver ist nicht erreichbar';
  if (/certificate|CERT_|self.signed|altname/i.test(`${code} ${e.message}`)) return 'Das Zertifikat des Mailservers wurde nicht anerkannt';
  if (/wrong version number|SSL|TLS/i.test(e.message)) return 'Die verschlüsselte Verbindung kam nicht zustande (Port und SMTP_SICHERHEIT prüfen)';
  return 'Die Verbindung zum Mailserver ist fehlgeschlagen';
}

function verbinde(cfg: SmtpEinstellung): Promise<Socket> {
  return new Promise((fertig, fehler) => {
    const s: Socket = cfg.sicherheit === 'tls' ? tlsConnect({ host: cfg.host, port: cfg.port, servername: cfg.host, ca: cfg.ca }) : netConnect({ host: cfg.host, port: cfg.port });
    const zeit = setTimeout(() => {
      s.destroy();
      fehler(new MailFehler('Der Mailserver ist nicht erreichbar'));
    }, ZEIT_MS);
    const ab = (e: Error) => {
      clearTimeout(zeit);
      s.destroy();
      fehler(new MailFehler(uebersetze(e)));
    };
    s.once('error', ab);
    s.once(cfg.sicherheit === 'tls' ? 'secureConnect' : 'connect', () => {
      clearTimeout(zeit);
      s.off('error', ab);
      fertig(s);
    });
  });
}

function verschluessle(cfg: SmtpEinstellung, roh: Socket): Promise<Socket> {
  return new Promise((fertig, fehler) => {
    const s = tlsConnect({ socket: roh, servername: cfg.host, ca: cfg.ca });
    const ab = (e: Error) => {
      s.destroy();
      fehler(new MailFehler(uebersetze(e)));
    };
    s.once('error', ab);
    s.once('secureConnect', () => {
      s.off('error', ab);
      fertig(s);
    });
  });
}

/** Schickt eine Mail. Wirft MailFehler mit einem Text, der sich anzeigen lässt. */
export async function sendeMail(cfg: SmtpEinstellung, mail: Mail, jetzt: Date = new Date()): Promise<void> {
  if (!istMailAdresse(mail.an)) throw new MailFehler('Die Adresse des Empfängers ist ungültig');
  const ich = hostname().replace(/[^A-Za-z0-9.-]/g, '') || 'localhost';
  const l = new Leitung(await verbinde(cfg));
  try {
    await l.befehl(null, [220], 'Der Mailserver meldet sich nicht wie erwartet');
    let kann = await l.befehl(`EHLO ${ich}`, [250], 'Der Mailserver lehnt die Begrüßung ab');
    if (cfg.sicherheit === 'starttls') {
      if (!kann.some((z) => /^250[ -]STARTTLS\b/i.test(z))) throw new MailFehler('Der Mailserver bietet keine Verschlüsselung (STARTTLS) an – es wurde nichts gesendet');
      await l.befehl('STARTTLS', [220], 'Der Mailserver lehnt die Verschlüsselung ab');
      l.wechsle(await verschluessle(cfg, l.socket));
      kann = await l.befehl(`EHLO ${ich}`, [250], 'Der Mailserver lehnt die Begrüßung ab');
    }
    if (cfg.benutzer) {
      if (cfg.sicherheit === 'keine') throw new MailFehler('Anmeldung ohne Verschlüsselung ist nicht erlaubt');
      const verfahren = kann.find((z) => /^250[ -]AUTH\b/i.test(z))?.toUpperCase() ?? '';
      if (verfahren.includes('PLAIN')) {
        await l.befehl(`AUTH PLAIN ${b64(`\0${cfg.benutzer}\0${cfg.passwort}`)}`, [235], 'Der Mailserver lehnt die Anmeldung ab (Benutzer oder Passwort)');
      } else if (verfahren.includes('LOGIN')) {
        await l.befehl('AUTH LOGIN', [334], 'Der Mailserver lehnt die Anmeldung ab');
        await l.befehl(b64(cfg.benutzer), [334], 'Der Mailserver lehnt die Anmeldung ab');
        await l.befehl(b64(cfg.passwort), [235], 'Der Mailserver lehnt die Anmeldung ab (Benutzer oder Passwort)');
      } else throw new MailFehler('Der Mailserver bietet kein unterstütztes Anmeldeverfahren an (PLAIN oder LOGIN)');
    }
    await l.befehl(`MAIL FROM:<${cfg.absender}>`, [250], 'Der Mailserver lehnt den Absender ab');
    await l.befehl(`RCPT TO:<${mail.an}>`, [250, 251], 'Der Mailserver lehnt den Empfänger ab');
    await l.befehl('DATA', [354], 'Der Mailserver nimmt die Mail nicht an');
    // Zeilen, die mit einem Punkt beginnen, bekommen einen zweiten – sonst hielte der Server sie für das Ende
    const inhalt = baueMail(cfg, mail, jetzt).replace(/^\./gm, '..');
    await l.befehl(`${inhalt}\r\n.`, [250], 'Der Mailserver nimmt die Mail nicht an');
    l.socket.write('QUIT\r\n');
  } finally {
    l.beende();
  }
}
