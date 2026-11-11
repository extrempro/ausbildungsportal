import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createServer as createTlsServer, TLSSocket } from 'node:tls';
import { loadConfig } from '../config';
import { baueMail, MailFehler, sendeMail } from '../smtp';
import type { SmtpEinstellung } from '../smtp';

/** Nachgestellter Mailserver: merkt sich, was der Client sendet, und antwortet wie ein echter. */
interface Gegenstelle {
  port: number;
  befehle: string[];
  daten: string[];
  zu: () => Promise<void>;
}
interface Verhalten {
  starttls?: { key: string; cert: string } | 'fehlt';
  tls?: { key: string; cert: string };
  auth?: 'PLAIN' | 'LOGIN';
  passwortFalsch?: boolean;
  empfaengerAbgelehnt?: boolean;
}

function gegenstelle(v: Verhalten = {}): Promise<Gegenstelle> {
  const g: Gegenstelle = { port: 0, befehle: [], daten: [], zu: async () => {} };
  const bediene = (s: Socket, verschluesselt: boolean) => {
    let puffer = '';
    let inDaten = false;
    let login = 0;
    const sag = (t: string) => s.write(`${t}\r\n`);
    if (!verschluesselt || v.tls) sag('220 test ESMTP');
    s.on('error', () => {});
    s.on('data', (d) => {
      puffer += d.toString('utf8');
      let i: number;
      while ((i = puffer.indexOf('\r\n')) >= 0) {
        const zeile = puffer.slice(0, i);
        puffer = puffer.slice(i + 2);
        if (inDaten) {
          if (zeile === '.') {
            inDaten = false;
            sag('250 2.0.0 angenommen');
          } else g.daten.push(zeile);
          continue;
        }
        if (login) {
          g.befehle.push(`(login ${login})`);
          login = login === 1 ? 2 : 0;
          sag(login === 2 ? '334 UGFzc3dvcmQ6' : v.passwortFalsch ? '535 5.7.8 Zugangsdaten falsch' : '235 2.7.0 ok');
          continue;
        }
        g.befehle.push(zeile);
        const b = zeile.toUpperCase();
        if (b.startsWith('EHLO')) {
          s.write('250-test\r\n');
          if (v.starttls && v.starttls !== 'fehlt' && !verschluesselt) s.write('250-STARTTLS\r\n');
          if (v.auth) s.write(`250-AUTH ${v.auth}\r\n`);
          sag('250 SIZE 1000000');
        } else if (b === 'STARTTLS' && v.starttls && v.starttls !== 'fehlt') {
          sag('220 los');
          s.removeAllListeners('data');
          const sicher = new TLSSocket(s, { isServer: true, key: v.starttls.key, cert: v.starttls.cert });
          bediene(sicher, true);
        } else if (b.startsWith('AUTH PLAIN')) sag(v.passwortFalsch ? '535 5.7.8 Zugangsdaten falsch' : '235 2.7.0 ok');
        else if (b === 'AUTH LOGIN') {
          login = 1;
          sag('334 VXNlcm5hbWU6');
        } else if (b.startsWith('MAIL FROM')) sag('250 ok');
        else if (b.startsWith('RCPT TO')) sag(v.empfaengerAbgelehnt ? '550 5.1.1 Empfänger unbekannt' : '250 ok');
        else if (b === 'DATA') {
          inDaten = true;
          sag('354 weiter');
        } else if (b === 'QUIT') {
          sag('221 tschüss');
          s.end();
        } else sag('502 unbekannt');
      }
    });
  };
  return new Promise((fertig) => {
    const server: Server = v.tls ? createTlsServer({ key: v.tls.key, cert: v.tls.cert }, (s) => bediene(s, true)) : createServer((s) => bediene(s, false));
    server.listen(0, '127.0.0.1', () => {
      g.port = (server.address() as { port: number }).port;
      g.zu = () => new Promise((r) => server.close(() => r()));
      fertig(g);
    });
  });
}

const cfg = (port: number, mehr: Partial<SmtpEinstellung> = {}): SmtpEinstellung => ({ host: 'localhost', port, sicherheit: 'keine', benutzer: '', passwort: '', absender: 'portal@firma.test', ...mehr });
const MAIL = { an: 'personal@firma.test', betreff: 'Urlaub genehmigt: Jörg Müßig, 21.12.2026–03.01.2027', text: 'Guten Tag,\n\n.eine Zeile mit Punkt am Anfang\nÄ ö ü ß – fertig.' };

/** Schlüssel und Zertifikat nur für diesen Testlauf – wird nicht gespeichert. Ohne openssl werden die TLS-Tests übersprungen. */
function zertifikat(): { key: string; cert: string } | null {
  const ordner = mkdtempSync(join(tmpdir(), 'smtp-test-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(ordner, 'k.pem'), '-out', join(ordner, 'c.pem'), '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
    return { key: readFileSync(join(ordner, 'k.pem'), 'utf8'), cert: readFileSync(join(ordner, 'c.pem'), 'utf8') };
  } catch {
    return null;
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}
const zert = zertifikat();

test('SMTP: Mail geht in der richtigen Reihenfolge an die Gegenstelle; Umlaute, Punkt am Zeilenanfang und Kopfzeilen stimmen', async () => {
  const g = await gegenstelle();
  await sendeMail(cfg(g.port), MAIL, new Date('2026-11-11T10:00:00Z'));
  await g.zu();
  assert.deepEqual(
    g.befehle.map((b) => b.replace(/^EHLO .*/, 'EHLO')),
    ['EHLO', 'MAIL FROM:<portal@firma.test>', 'RCPT TO:<personal@firma.test>', 'DATA', 'QUIT'],
  );
  const leer = g.daten.indexOf('');
  const kopf = g.daten.slice(0, leer).join('\n');
  assert.match(kopf, /^From: Ausbildungsportal <portal@firma\.test>$/m);
  assert.match(kopf, /^To: <personal@firma\.test>$/m);
  assert.match(kopf, /^Date: Wed, 11 Nov 2026 10:00:00 \+0000$/m);
  assert.match(kopf, /^Content-Type: text\/plain; charset=utf-8$/m);
  assert.match(kopf, /^Message-ID: <[0-9a-f]{24}@firma\.test>$/m);
  // der Betreff ist kodiert und ergibt entschlüsselt wieder den Text
  const betreff = [...kopf.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)].map((m) => Buffer.from(m[1], 'base64').toString('utf8')).join('');
  assert.equal(betreff, MAIL.betreff);
  assert.ok(g.daten.every((z) => z.length <= 78), 'keine überlange Zeile');
  assert.equal(Buffer.from(g.daten.slice(leer + 1).join(''), 'base64').toString('utf8'), MAIL.text.replace(/\n/g, '\r\n'));
});

test('SMTP: Zeilenumbrüche in Betreff oder Adresse schleusen keine Kopfzeilen ein', async () => {
  const roh = baueMail({ absender: 'portal@firma.test' }, { an: 'personal@firma.test', betreff: 'Hallo\r\nBcc: fremd@boese.test', text: 'x' }, new Date());
  assert.equal(roh.split('\r\n').filter((z) => /^bcc:/i.test(z)).length, 0);
  await assert.rejects(sendeMail(cfg(1), { an: 'a@b.de\r\nRCPT TO:<x@y.de>', betreff: 'x', text: 'x' }), /Empfängers ist ungültig/);
});

test('SMTP: Fehler der Gegenstelle kommen als lesbarer Text an – ohne Passwort', async () => {
  const abgelehnt = await gegenstelle({ empfaengerAbgelehnt: true });
  await assert.rejects(sendeMail(cfg(abgelehnt.port), MAIL), (e: unknown) => e instanceof MailFehler && /lehnt den Empfänger ab: 550 5\.1\.1/.test(e.message));
  await abgelehnt.zu();
  // niemand lauscht
  const frei = await gegenstelle();
  await frei.zu();
  await assert.rejects(sendeMail(cfg(frei.port), MAIL), (e: unknown) => e instanceof MailFehler && /nimmt auf diesem Port keine Verbindung an/.test(e.message));
  // STARTTLS verlangt, aber nicht angeboten: nichts wird gesendet
  const ohne = await gegenstelle({ starttls: 'fehlt' });
  await assert.rejects(sendeMail(cfg(ohne.port, { sicherheit: 'starttls' }), MAIL), /bietet keine Verschlüsselung \(STARTTLS\) an/);
  assert.ok(!ohne.befehle.some((b) => b.startsWith('MAIL FROM')));
  await ohne.zu();
});

test('SMTP mit STARTTLS und Anmeldung (PLAIN und LOGIN); falsches Passwort und fremdes Zertifikat werden gemeldet', { skip: zert ? false : 'openssl fehlt' }, async () => {
  const z = zert!;
  const g = await gegenstelle({ starttls: z, auth: 'PLAIN' });
  await sendeMail(cfg(g.port, { sicherheit: 'starttls', benutzer: 'portal', passwort: 'Geheim-123', ca: z.cert }), MAIL);
  await g.zu();
  const befehle = g.befehle.map((b) => b.replace(/^EHLO .*/, 'EHLO'));
  assert.deepEqual(befehle.slice(0, 4), ['EHLO', 'STARTTLS', 'EHLO', `AUTH PLAIN ${Buffer.from('\0portal\0Geheim-123').toString('base64')}`]);
  assert.ok(befehle.indexOf('STARTTLS') < befehle.findIndex((b) => b.startsWith('AUTH')), 'Anmeldung erst nach der Verschlüsselung');
  assert.ok(g.daten.length > 5);

  const login = await gegenstelle({ starttls: z, auth: 'LOGIN' });
  await sendeMail(cfg(login.port, { sicherheit: 'starttls', benutzer: 'portal', passwort: 'Geheim-123', ca: z.cert }), MAIL);
  await login.zu();
  assert.deepEqual(login.befehle.slice(3, 6), ['AUTH LOGIN', '(login 1)', '(login 2)']);

  const falsch = await gegenstelle({ starttls: z, auth: 'PLAIN', passwortFalsch: true });
  await assert.rejects(sendeMail(cfg(falsch.port, { sicherheit: 'starttls', benutzer: 'portal', passwort: 'Geheim-123', ca: z.cert }), MAIL), (e: unknown) => e instanceof MailFehler && /lehnt die Anmeldung ab/.test(e.message) && !e.message.includes('Geheim-123'));
  await falsch.zu();

  // ohne die passende Zertifizierungsstelle wird dem Server nicht vertraut
  const fremd = await gegenstelle({ starttls: z, auth: 'PLAIN' });
  await assert.rejects(sendeMail(cfg(fremd.port, { sicherheit: 'starttls', benutzer: 'portal', passwort: 'Geheim-123' }), MAIL), /Zertifikat des Mailservers wurde nicht anerkannt/);
  assert.ok(!fremd.befehle.some((b) => b.startsWith('AUTH')), 'kein Passwort an einen Server mit fremdem Zertifikat');
  await fremd.zu();
});

test('SMTP über TLS von Anfang an (Port 465)', { skip: zert ? false : 'openssl fehlt' }, async () => {
  const z = zert!;
  const g = await gegenstelle({ tls: z, auth: 'PLAIN' });
  await sendeMail(cfg(g.port, { sicherheit: 'tls', benutzer: 'portal', passwort: 'Geheim-123', ca: z.cert }), MAIL);
  await g.zu();
  assert.ok(g.befehle.some((b) => b.startsWith('AUTH PLAIN')) && !g.befehle.includes('STARTTLS') && g.daten.length > 5);
});

test('SMTP-Einstellungen: Vorgaben und Prüfungen', () => {
  const basis = { APP_URL: 'https://ausbildung.firma.test' };
  assert.equal(loadConfig(basis, []).smtp, null);
  assert.deepEqual(loadConfig({ ...basis, SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test' }, []).smtp, { host: 'mail.firma.test', port: 587, sicherheit: 'starttls', benutzer: '', passwort: '', absender: 'portal@firma.test' });
  assert.equal(loadConfig({ ...basis, SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test', SMTP_SICHERHEIT: 'tls' }, []).smtp?.port, 465);
  assert.equal(loadConfig({ ...basis, SMTP_HOST: 'relay', SMTP_ABSENDER: 'portal@firma.test', SMTP_SICHERHEIT: 'keine' }, []).smtp?.port, 25);
  for (const [env, fehler] of [
    [{ SMTP_HOST: 'mail.firma.test' }, /SMTP_ABSENDER/],
    [{ SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test', SMTP_SICHERHEIT: 'ssl' }, /SMTP_SICHERHEIT/],
    [{ SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test', SMTP_PORT: 'abc' }, /SMTP_PORT/],
    [{ SMTP_HOST: 'mail.firma.test', SMTP_ABSENDER: 'portal@firma.test', SMTP_BENUTZER: 'portal' }, /gehören zusammen/],
    [{ SMTP_HOST: 'relay', SMTP_ABSENDER: 'portal@firma.test', SMTP_SICHERHEIT: 'keine', SMTP_BENUTZER: 'portal', SMTP_PASSWORT: 'x' }, /unverschlüsselt/],
  ] as const) assert.throws(() => loadConfig({ ...basis, ...env }, []), fehler);
});
