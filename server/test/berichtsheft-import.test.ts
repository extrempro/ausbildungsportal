import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ausModell, erkenneWochen, zusammenfuehren } from '../berichtsheft-import';
import type { BenutzerZeile } from '../typen';
import { koerper, konto, ruf, sitzung, umgebung, zustaendig } from './hilfe';
import type { Umgebung } from './hilfe';

// „heute“ ist in der Testumgebung Dienstag, der 10.11.2026.
// So liefert pdftotext ein typisches Formular (Wochenform) – zwei Seiten, durch einen Seitenvorschub getrennt.
const FORMULAR = `Ausbildungsnachweis Nr. 12
Name: Anna Muster          Ausbildungsjahr: 1          Abteilung: IT
Woche vom 07.09.2026 bis 11.09.2026

Betriebliche Tätigkeiten                                                      Stunden
 - Arbeitsplätze für neue Kollegen eingerichtet                                   8
 - Drucker im Netz eingebunden und getestet                                      6,5
 - Tickets im Helpdesk bearbeitet                                                9,5

Unterweisungen, betrieblicher Unterricht, sonstige Schulungen                 Stunden
 Unterweisung Datenschutz und Informationssicherheit                             1,5

Themen des Berufsschulunterrichts                                             Stunden
 Subnetting und IPv4-Adressen
 Übungen zu Netzmasken                                                            6
 Am Freitag war ich krank.

Unterschrift Auszubildende/r                      Unterschrift Ausbilder/in
\fAusbildungsnachweis Nr. 13
KW 38/2026
Betriebliche Tätigkeiten
Server-Updates eingespielt 7
Backups geprüft
Themen des Berufsschulunterrichts
Englisch: Fachtexte 4
`;

// Tagesform aus einer Word-Datei
const TAGE = `Berichtsheft
Zeitraum: 14.09.2026 - 18.09.2026
Montag, 14.09.2026
Netzwerkkabel verlegt 8
Dienstag 15.09.
Betriebliche Unterweisung: Arbeitssicherheit 2
Patchfeld beschriftet 6
Mittwoch: Berufsschule
Datenbanken 8
Donnerstag
Monitore getauscht 8
`;

test('Muster: Wochen, Teile, Stunden und Seiten aus einem Formular; Zeilen zu Krankheit fallen weg', () => {
  const w = erkenneWochen(FORMULAR, '2026-11-10');
  assert.deepEqual(w.map((x) => [x.montag, x.form, x.seiten]), [
    ['2026-09-07', 'woche', [1]],
    ['2026-09-14', 'woche', [2]],
  ]);
  assert.deepEqual(w[0].betrieb, [
    { text: 'Arbeitsplätze für neue Kollegen eingerichtet', stunden: 8 },
    { text: 'Drucker im Netz eingebunden und getestet', stunden: 6.5 },
    { text: 'Tickets im Helpdesk bearbeitet', stunden: 9.5 },
  ]);
  assert.deepEqual(w[0].unterweisung, [{ text: 'Unterweisung Datenschutz und Informationssicherheit', stunden: 1.5 }]);
  assert.deepEqual(w[0].schule, [{ text: 'Subnetting und IPv4-Adressen\nÜbungen zu Netzmasken', stunden: 6 }]);
  assert.ok(!JSON.stringify(w).includes('krank'), 'kein Gesundheitsbezug im Bericht');
  assert.equal(w[0].hinweise.length, 1);
  assert.ok(!JSON.stringify(w).includes('Anna'), 'Kopfzeilen gehören nicht in den Bericht');
  // KW mit Jahr; eine Zeile ohne Stunden bleibt ein Eintrag mit 0 Stunden
  assert.deepEqual(w[1].betrieb, [
    { text: 'Server-Updates eingespielt', stunden: 7 },
    { text: 'Backups geprüft', stunden: 0 },
  ]);
  assert.deepEqual(w[1].schule, [{ text: 'Englisch: Fachtexte', stunden: 4 }]);
});

test('Muster: Tagesform – Wochentage, Überschrift nur für eine Zeile, jeder Tag beginnt mit dem Betrieb', () => {
  const [w] = erkenneWochen(TAGE, '2026-11-10');
  assert.equal(w.form, 'tag');
  assert.deepEqual(w.betrieb, [
    { text: 'Netzwerkkabel verlegt', stunden: 8, tag: '2026-09-14' },
    { text: 'Patchfeld beschriftet', stunden: 6, tag: '2026-09-15' },
    { text: 'Monitore getauscht', stunden: 8, tag: '2026-09-17' },
  ]);
  assert.deepEqual(w.unterweisung, [{ text: 'Arbeitssicherheit', stunden: 2, tag: '2026-09-15' }]);
  assert.deepEqual(w.schule, [{ text: 'Datenbanken', stunden: 8, tag: '2026-09-16' }]);
});

// Export eines digitalen Berichtshefts (Tagesform): Deckblatt, Inhaltsverzeichnis, je Woche eine Seite mit Tagen als Kästen –
// so liefert ihn pdftotext -layout. Ort und Stunden stehen im Kopf des Tages, darunter die Punkte und noch einmal die Stunden.
const EXPORT_KAESTEN = `Ausbildungsnachweis

Name, Vorname      Muster, Anna
Ausbildungsberuf   Musterberuf
Ausbildungsbeginn 01.09.2025
Exportzeitraum     07.09.2026 bis 27.09.2026
                                                         Datum des Exports: 10.11.2026
                                                                               Seite 1
\fInhaltsverzeichnis

Ausbildungswoche 07.09.2026 bis 27.09.2026
                                         Anwesend     Abwesend
   Berichtheftswoche        Seitenzahl                             Status    Ort
                                         (in Tagen)   (in Tagen)
07.09.2026 bis 13.09.2026       3            0            5          ✓      Urlaub
14.09.2026 bis 20.09.2026       4            4            1          ✓      Schule
21.09.2026 bis 27.09.2026       5            5            0          ✓      Betrieb
    Summe Fehltage
                                                          1
 (sonstige Abwesenheit)
                                                                             Seite 2
\fAusbildungsnachweis auf Tagesbasis

Auszubildende/r
Muster, Anna
Ausbilder Ben Beispiel    Status
Freigegeben von Ben Beispiel
15.09.2026 freigegeben. ✓

 Ausbildungswoche     07.09.2026 bis 13.09.2026

 Mo | 07.09.2026 | Urlaub | abwesend                              ◷ 00:00
 Di | 08.09.2026 | Urlaub | abwesend                              ◷ 00:00
 Do | 10.09.2026 | Feiertag | abwesend                            ◷ 00:00

                                                  Dauer gesamt:   ◷ 00:00
                                                                     Seite 3
\fAusbildungsnachweis auf Tagesbasis

Auszubildende/r
Muster, Anna
Ausbilder Ben Beispiel    Status
Freigegeben von Ben Beispiel
22.09.2026 freigegeben. ✓

 Ausbildungswoche     14.09.2026 bis 20.09.2026

 Mo | 14.09.2026 | Schule | anwesend                                 ◷ 08:00
    • Subnetting und IPv4-Adressen                                       08:00
    • Wirtschaft und Gesellschaft

 Di | 15.09.2026 | Schule | anwesend                                 ◷ 08:00
    • Datenbanken                                                        08:00

 Mi | 16.09.2026 | Sonstige Abwesenheit | abwesend                   ◷ 00:00

 Fr | 18.09.2026 | Schule | anwesend                                 ◷ 04:30
    • Englisch: Fachtexte                                                04:30

                                                     Dauer gesamt:   ◷ 20:30
                                                                        Seite 4
\fAusbildungsnachweis auf Tagesbasis

Auszubildende/r
Muster, Anna
Ausbilder Ben Beispiel    Status
Freigegeben von Ben Beispiel
29.09.2026 freigegeben. ✓

 Ausbildungswoche      21.09.2026 bis 27.09.2026

 Mo | 21.09.2026 | Betrieb | anwesend                ◷ 08:00
    • Arbeitsplätze für neue Kollegen eingerichtet     08:00
    • Drucker im Netz eingebunden
    • Tickets bearbeitet

 Di | 22.09.2026 | Betrieb | anwesend                ◷ 08:00
    • Server-Updates eingespielt                       08:00

 So | 27.09.2026 | Betrieb | anwesend                ◷ 06:00
    • Wartungsfenster betreut                          06:00
                                                       Seite 5
\fAusbildungsnachweis auf Tagesbasis

    • Backups nach der Wartung geprüft

                                     Dauer gesamt:   ◷ 22:00
                                                        Seite 6
`;

// Export eines anderen Programms: Kopf mit Woche auf jeder Seite, der Ort in der Zeile unter dem Tag, Uhrzeiten im Text,
// Stunden je Abschnitt in eckigen Klammern, Abschnitte getrennt durch „—“; ein Tag läuft über die Seite weiter.
const EXPORT_ABSCHNITTE = `                                          AUSBILDUNGSNACHWEIS
                                 Zeitraum: 21.09.2026 - 27.09.2026
                                                        Name Anna Muster
                                      Ausbildungsberuf Musterberuf
                                            Ausbildungsdaten 01.09.2025 - 31.08.2028
                                                 Start des Berichtshefts 01.09.2025
Statistik
Hinweis: Für einen Tag können im Berichtsheft mehrere Kategorien ausgewählt werden (z. B. Schule und Krank).
Betrieb an 3 Tagen • Schule an 0 Tagen • Anderes an 0 Tagen
Krank an 0 Tagen • Urlaub an 0 Tagen • Frei an 4 Tagen
\fName Anna Muster
Ausbildungsberuf Musterberuf                                   Ausbildungsnachweis #3
Ausbildungsbetrieb                                         21.09.2026 - 27.09.2026 (KW 39-2026)
  DATUM                                              TÄTIGKEITEN                                          STATUS

   MO 21.09.2026
   Frei

   DI 22.09.2026
   Betrieb               Abt. IT                                                                         8:00

                         08:00 - 12:00 Uhr

                         Notebooks für neue Kollegen vorbereitet
                         Software verteilt

                         12:30 - 16:30 Uhr

                         Tickets im Helpdesk bearbeitet

   MI 23.09.2026
   Betrieb               Abt. IT                                                                         6:30

                         08:00 - 11:00 Uhr

                         Server-Updates:
                         - Updates eingespielt
                         - Dienste geprüft [3:00]
                         —

                         11:30 - 13:00 Uhr

                         Backups geprüft

Durch die nachfolgenden Unterschriften wird die Richtigkeit und Vollständigkeit der obigen Angaben bestätigt.

DATUM, UNTERSCHRIFT AUSZUBILDENDE/R                      DATUM, UNTERSCHRIFT AUSBILDER/IN
\fName Anna Muster
Ausbildungsberuf Musterberuf                                   Ausbildungsnachweis #3
Ausbildungsbetrieb                                         21.09.2026 - 27.09.2026 (KW 39-2026)
                         Wiederherstellung getestet [1:30]
                         —

                         13:30 - 15:30 Uhr

                         Netzwerkschrank beschriftet [2:00]

   DO 24.09.2026
   Krank

   FR 25.09.2026
   Betrieb               Abt. IT                                                                         2:00

                         12:30 - 14:30 Uhr

                         Übergabe an den Spätdienst

Durch die nachfolgenden Unterschriften wird die Richtigkeit und Vollständigkeit der obigen Angaben bestätigt.
`;

test('Muster: Export mit Tagen als Kästen – Tag, Ort und Stunden aus dem Kopf, ein Eintrag je Tag, Deckblatt und Verzeichnis fallen weg', () => {
  const w = erkenneWochen(EXPORT_KAESTEN, '2026-11-10');
  assert.deepEqual(w.map((x) => [x.montag, x.form, x.seiten]), [
    ['2026-09-07', 'tag', [3]],
    ['2026-09-14', 'tag', [4]],
    ['2026-09-21', 'tag', [5, 6]],
  ]);
  assert.deepEqual([...w[0].betrieb, ...w[0].unterweisung, ...w[0].schule], [], 'Urlaub und Feiertag: nichts einzutragen');
  assert.deepEqual(w[0].hinweise, []);
  assert.deepEqual(w[1].schule, [
    { text: 'Subnetting und IPv4-Adressen\nWirtschaft und Gesellschaft', stunden: 8, tag: '2026-09-14' },
    { text: 'Datenbanken', stunden: 8, tag: '2026-09-15' },
    { text: 'Englisch: Fachtexte', stunden: 4.5, tag: '2026-09-18' },
  ]);
  assert.deepEqual(w[1].betrieb, []);
  assert.match(w[1].hinweise.join(' '), /abwesend/, 'sonstige Abwesenheit: als Hinweis, nicht im Text');
  assert.deepEqual(w[2].betrieb, [
    { text: 'Arbeitsplätze für neue Kollegen eingerichtet\nDrucker im Netz eingebunden\nTickets bearbeitet', stunden: 8, tag: '2026-09-21' },
    { text: 'Server-Updates eingespielt', stunden: 8, tag: '2026-09-22' },
    { text: 'Wartungsfenster betreut\nBackups nach der Wartung geprüft', stunden: 6, tag: '2026-09-27' },
  ]);
  const alles = JSON.stringify(w);
  for (const weg of ['Anna', 'Ben', 'Seite', 'gesamt', '08:00', 'anwesend', 'Fehltage', 'freigegeben']) assert.ok(!alles.includes(weg), `„${weg}“ gehört nicht in den Bericht`);
});

test('Muster: Export mit Abschnitten – Stunden je Abschnitt, Uhrzeiten bleiben im Text, Kopfzeilen der Folgeseite fallen weg', () => {
  const w = erkenneWochen(EXPORT_ABSCHNITTE, '2026-11-10');
  assert.equal(w.length, 1);
  assert.equal(w[0].form, 'tag');
  assert.deepEqual(w[0].seiten, [2, 3]);
  assert.deepEqual(w[0].betrieb, [
    { text: 'Abt. IT\n08:00 - 12:00 Uhr\nNotebooks für neue Kollegen vorbereitet\nSoftware verteilt\n12:30 - 16:30 Uhr\nTickets im Helpdesk bearbeitet', stunden: 8, tag: '2026-09-22' },
    { text: 'Abt. IT\n08:00 - 11:00 Uhr\nServer-Updates:\n- Updates eingespielt\n- Dienste geprüft', stunden: 3, tag: '2026-09-23' },
    { text: '11:30 - 13:00 Uhr\nBackups geprüft\nWiederherstellung getestet', stunden: 1.5, tag: '2026-09-23' },
    { text: '13:30 - 15:30 Uhr\nNetzwerkschrank beschriftet', stunden: 2, tag: '2026-09-23' },
    { text: 'Abt. IT\n12:30 - 14:30 Uhr\nÜbergabe an den Spätdienst', stunden: 2, tag: '2026-09-25' },
  ]);
  // „Krank“ am Donnerstag: nur ein Hinweis; die Statistik auf dem Deckblatt („Krank an 0 Tagen“) zählt nicht doppelt
  assert.equal(w[0].hinweise.length, 1);
  const alles = JSON.stringify(w);
  for (const weg of ['Anna', 'Krank', 'Unterschrift', 'Musterberuf', 'Statistik', '[3:00]', '—']) assert.ok(!alles.includes(weg), `„${weg}“ gehört nicht in den Bericht`);
});

test('Muster: „So …“ am Satzanfang ist kein Sonntag; Sonntag ausgeschrieben schon', () => {
  const [w] = erkenneWochen('Woche vom 14.09.2026\nMontag\nSo haben wir das Netz geprüft 4\nSonntag\nWartung 3\n', '2026-11-10');
  assert.deepEqual(w.betrieb, [
    { text: 'So haben wir das Netz geprüft', stunden: 4, tag: '2026-09-14' },
    { text: 'Wartung', stunden: 3, tag: '2026-09-20' },
  ]);
});

test('Sprachmodell ergänzt nur: leere Woche gefüllt, erfundene Woche und erfundene Einträge fallen weg', () => {
  const text = `Woche vom 05.10.2026 bis 09.10.2026\nNetzwerk dokumentiert, Schränke beschriftet\n\fWoche vom 12.10.2026 bis 16.10.2026\nlauter Kram`;
  const muster = erkenneWochen(text, '2026-11-10');
  // die Muster finden beide Wochen, aber nur Einträge ohne Überschrift – die gehören zum Betrieb
  assert.equal(muster.length, 2);
  const leer = muster.map((w) => ({ ...w, betrieb: [] }));
  const modell = ausModell({
    wochen: [
      { von: '2026-10-05', betrieb: [{ text: 'Netzwerk dokumentiert, Schränke beschriftet', stunden: 8 }, { text: 'Etwas Erfundenes', stunden: 4 }], unterweisung: [], schule: [] },
      { von: '2030-01-07', betrieb: [{ text: 'Netzwerk dokumentiert', stunden: 8 }], unterweisung: [], schule: [] },
      { von: 'kein Datum', betrieb: [], unterweisung: [], schule: [] },
    ],
  });
  assert.equal(modell.length, 2);
  const r = zusammenfuehren(leer, modell, text);
  assert.equal(r.length, 2, 'die Woche 2030 steht nicht im Text');
  assert.deepEqual(r[0].betrieb, [{ text: 'Netzwerk dokumentiert, Schränke beschriftet', stunden: 8 }]);
  assert.match(r[0].hinweise.join(' '), /Sprachmodell/);
});

/** Ausbilderin Petra, Azubi Anna (Beginn 01.08.2025, mit Unterschrift), Azubi Ben eines anderen Ausbilders */
interface Welt {
  u: Umgebung;
  petra: BenutzerZeile;
  anna: BenutzerZeile;
  ben: BenutzerZeile;
  ordner: string;
}
const PFAD = 'M 10 10 L 20 20 L 30 25 L 40 22 L 50 30 L 60 28 L 70 35';

async function welt(): Promise<Welt> {
  const daten = mkdtempSync(join(tmpdir(), 'ap-berichte-einlesen-'));
  const u = await umgebung({ DATA_DIR: daten });
  const petra = konto(u.db, 'ausbilder', 'Petra Lang');
  const anna = konto(u.db, 'azubi', 'Anna Azubi');
  const ben = konto(u.db, 'azubi', 'Ben Azubi');
  zustaendig(u.db, anna, petra);
  await ruf(u, 'PUT', `/api/azubis/${anna.id}/profil`, { cookies: sitzung(u, petra), body: { ausbildungsbeginn: '2025-08-01', ausbilderId: petra.id } });
  return { u, petra, anna, ben, ordner: join(daten, 'import') };
}

test('Alte Berichte: ohne Dienst Text einlesen, als Entwurf übernehmen, gesammelt einreichen – der Ausbilder sieht „eingelesen“', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.anna);
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  assert.equal(koerper(await ruf(w.u, 'GET', pfad, { cookies: c })).dienst, false);
  const r = koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: { text: FORMULAR } }));
  assert.equal(r.status, 'fertig');
  assert.deepEqual(r.wochen.map((x: { montag: string; stand: string; vorgewaehlt: boolean }) => [x.montag, x.stand, x.vorgewaehlt]), [
    ['2026-09-07', 'neu', true],
    ['2026-09-14', 'neu', true],
  ]);
  // die PDF verlangt den Dienst
  assert.equal((await ruf(w.u, 'POST', pfad, { cookies: c, body: Buffer.from('%PDF-1.7 Test') })).status, 409);
  assert.equal((await ruf(w.u, 'POST', pfad, { cookies: c, body: { text: '' } })).status, 400);

  // übernehmen: zwei Entwürfe mit Vermerk „eingelesen“ und den Feiertagen/Urlaub der Woche
  const wochen = r.wochen.map((x: Record<string, unknown>) => ({ montag: x.montag, form: x.form, betrieb: x.betrieb, unterweisung: x.unterweisung, schule: x.schule, seiten: x.seiten }));
  const ue = koerper(await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen } }));
  assert.deepEqual(ue, { angelegt: 2, ohneStunden: 0 });
  const b = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-09-07`, { cookies: c }));
  assert.equal(b.status, 'entwurf');
  assert.equal(b.summe.gesamt, 31.5);
  assert.deepEqual(b.verlauf.map((v: { aktion: string }) => v.aktion), ['eingelesen']);
  // ein zweites Mal geht nicht – die Woche hat jetzt einen Bericht
  assert.equal((await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen } })).status, 409);
  const nochmal = koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: { text: FORMULAR } }));
  assert.ok(nochmal.wochen.every((x: { stand: string; vorgewaehlt: boolean }) => x.stand === 'vorhanden' && !x.vorgewaehlt));
  // Zukunft und vor der Ausbildung gehen nicht
  for (const montag of ['2026-11-16', '2025-06-02']) {
    assert.equal((await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen: [{ montag, form: 'woche', betrieb: [{ text: 'x', stunden: 8 }] }] } })).status, 400, montag);
  }

  // Entwürfe gesammelt einreichen – erst mit Unterschrift
  const entwuerfe = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/einlesen-entwuerfe`, { cookies: c })).wochen;
  assert.deepEqual(entwuerfe.map((x: { montag: string; stunden: number }) => [x.montag, x.stunden]), [
    ['2026-09-07', 31.5],
    ['2026-09-14', 11],
  ]);
  const ohne = await ruf(w.u, 'POST', `${pfad}/einreichen`, { cookies: c, body: { montage: ['2026-09-07', '2026-09-14'] } });
  assert.equal(ohne.status, 409);
  assert.equal(koerper(ohne).code, 'unterschrift');
  await ruf(w.u, 'PUT', '/api/ich/unterschrift', { cookies: c, body: { pfad: PFAD } });
  assert.equal(koerper(await ruf(w.u, 'POST', `${pfad}/einreichen`, { cookies: c, body: { montage: ['2026-09-07', '2026-09-14'] } })).eingereicht, 2);
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/einlesen-entwuerfe`, { cookies: c })).wochen.length, 0);
  assert.equal((await ruf(w.u, 'POST', `${pfad}/einreichen`, { cookies: c, body: { montage: ['2026-09-07'] } })).status, 409, 'schon eingereicht');

  // der Ausbilder sieht beim Abzeichnen, dass sie eingelesen sind
  const offen = koerper(await ruf(w.u, 'GET', '/api/abzeichnen', { cookies: sitzung(w.u, w.petra) })).offen;
  assert.deepEqual(offen.map((o: { montag: string; eingelesen: boolean }) => [o.montag, o.eingelesen]), [
    ['2026-09-07', true],
    ['2026-09-14', true],
  ]);
});

test('Alte Berichte: nur der Azubi selbst – andere Azubis, Ausbilder und Admin kommen nicht heran', async () => {
  const w = await welt();
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  assert.equal((await ruf(w.u, 'GET', pfad, { cookies: sitzung(w.u, w.ben) })).status, 404);
  assert.equal((await ruf(w.u, 'POST', pfad, { cookies: sitzung(w.u, w.ben), body: { text: FORMULAR } })).status, 404);
  assert.equal((await ruf(w.u, 'GET', pfad, { cookies: sitzung(w.u, w.petra) })).status, 403);
  assert.equal((await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: sitzung(w.u, w.petra), body: { wochen: [] } })).status, 403);
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/einlesen-entwuerfe`, { cookies: sitzung(w.u, w.ben) })).status, 404);
});

test('Alte Berichte: mit Dienst ein Auftrag – die Originalseiten hängen danach am Bericht, der Auftrag ist weg', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.anna);
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  mkdirSync(w.ordner, { recursive: true });
  writeFileSync(join(w.ordner, '.bereit'), '');
  utimesSync(join(w.ordner, '.bereit'), w.u.uhr.jetzt, w.u.uhr.jetzt);
  const r = await ruf(w.u, 'POST', pfad, { cookies: c, body: Buffer.from('%PDF-1.7 erfundene Berichte') });
  assert.equal(r.status, 202);
  const id = koerper(r).id as string;
  assert.deepEqual(readdirSync(join(w.ordner, id)).sort(), ['art', 'auftrag', 'eingang.pdf', 'wer']);
  assert.equal(koerper(await ruf(w.u, 'GET', `${pfad}/${id}`, { cookies: c })).status, 'laeuft');
  // andere sehen den Auftrag nicht – auch nicht die Ausbilderin über den Schulplan
  assert.equal((await ruf(w.u, 'GET', `/api/azubis/${w.ben.id}/einlesen/${id}`, { cookies: sitzung(w.u, w.ben) })).status, 404);
  assert.equal((await ruf(w.u, 'GET', `/api/schulbloecke/einlesen/${id}`, { cookies: sitzung(w.u, w.petra) })).status, 404);

  // der Dienst ist fertig: Text mit zwei Seiten, einzelne Seiten als PDF
  writeFileSync(join(w.ordner, id, 'text.txt'), FORMULAR);
  writeFileSync(join(w.ordner, id, 'seite-1.pdf'), '%PDF-1.7 Seite 1');
  writeFileSync(join(w.ordner, id, 'seite-2.pdf'), '%PDF-1.7 Seite 2');
  writeFileSync(join(w.ordner, id, 'fertig'), 'modell=nein\nquelle=texterkennung\n');
  const s = koerper(await ruf(w.u, 'GET', `${pfad}/${id}`, { cookies: c }));
  assert.equal(s.status, 'fertig');
  assert.equal(s.seitenDabei, true);
  assert.ok(s.wochen.every((x: { unsicher: boolean }) => x.unsicher), 'Texterkennung ist unsicher');
  const erste = s.wochen[0];
  // eine Seite, die es nicht gibt, wird stillschweigend übergangen
  await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { auftrag: id, wochen: [{ ...erste, seiten: [1, 9] }] } });
  const b = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-09-07`, { cookies: c }));
  assert.deepEqual(b.anhaenge.map((a: { name: string; art: string }) => [a.name, a.art]), [['Original Seite 1.pdf', 'pdf']]);
  assert.equal((await ruf(w.u, 'GET', `${pfad}/${id}`, { cookies: c })).status, 404, 'der Auftrag ist gelöscht');
});

test('Alte Berichte: Einträge am Samstag nur mit Freischaltung im Profil', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.anna);
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  const text = 'Zeitraum: 14.09.2026 - 18.09.2026\nMontag, 14.09.2026\nNetzwerkkabel verlegt 8\nSamstag\nMesseaufbau 6';
  const [woche] = koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: { text } })).wochen;
  assert.equal(woche.vorgewaehlt, false);
  assert.match(woche.hinweise.join(' '), /Samstag oder Sonntag/);
  const daten = { montag: woche.montag, form: woche.form, betrieb: woche.betrieb, unterweisung: [], schule: [], seiten: [] };
  const r = await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen: [daten] } });
  assert.equal(r.status, 400);
  assert.match(koerper(r).fehler, /^KW 38\/2026: Samstag und Sonntag/);
  // freigeschaltet: angehakt und übernehmbar
  const profil = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/profil`, { cookies: sitzung(w.u, w.petra) })).profil;
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/profil`, { cookies: sitzung(w.u, w.petra), body: { ...profil, wochenende: true } });
  assert.equal(koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: { text } })).wochen[0].vorgewaehlt, true);
  assert.equal(koerper(await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen: [daten] } })).angelegt, 1);
});

test('Alte Berichte: ein leerer Entwurf wird ersetzt, ein Entwurf mit Inhalt bleibt', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.anna);
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  // KW 37: leerer Entwurf (nur gespeichert), KW 38: Entwurf mit einem Eintrag
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/berichte/2026-09-07`, { cookies: c, body: { inhalt: { betrieb: [] } } });
  await ruf(w.u, 'PUT', `/api/azubis/${w.anna.id}/berichte/2026-09-14`, { cookies: c, body: { inhalt: { betrieb: [{ text: 'Schon geschrieben', stunden: 8 }] } } });
  const r = koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: { text: FORMULAR } }));
  assert.deepEqual(r.wochen.map((x: { montag: string; stand: string; vorgewaehlt: boolean }) => [x.montag, x.stand, x.vorgewaehlt]), [
    ['2026-09-07', 'leer', true],
    ['2026-09-14', 'vorhanden', false],
  ]);
  assert.match(r.wochen[0].hinweise[0], /Ersetzt deinen leeren Entwurf/);
  const woche = (x: Record<string, unknown>) => ({ montag: x.montag, form: x.form, betrieb: x.betrieb, unterweisung: x.unterweisung, schule: x.schule, seiten: [] });
  assert.equal((await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen: [woche(r.wochen[1])] } })).status, 409);
  assert.equal(koerper(await ruf(w.u, 'POST', `${pfad}/uebernehmen`, { cookies: c, body: { wochen: [woche(r.wochen[0])] } })).angelegt, 1);
  const b = koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-09-07`, { cookies: c }));
  assert.equal(b.summe.gesamt, 31.5);
  assert.deepEqual(b.verlauf.map((v: { aktion: string }) => v.aktion), ['eingelesen']);
  assert.equal(koerper(await ruf(w.u, 'GET', `/api/azubis/${w.anna.id}/berichte/2026-09-14`, { cookies: c })).inhalt.betrieb[0].text, 'Schon geschrieben');
});

test('Alte Berichte: Verweise (Symlinks) vom Dienst werden nicht gelesen – weder Text noch Seiten noch fremde Auftragsordner', async () => {
  const w = await welt();
  const c = sitzung(w.u, w.anna);
  const pfad = `/api/azubis/${w.anna.id}/einlesen`;
  mkdirSync(w.ordner, { recursive: true });
  writeFileSync(join(w.ordner, '.bereit'), '');
  utimesSync(join(w.ordner, '.bereit'), w.u.uhr.jetzt, w.u.uhr.jetzt);
  const id = koerper(await ruf(w.u, 'POST', pfad, { cookies: c, body: Buffer.from('%PDF-1.7 erfundene Berichte') })).id as string;
  // ein übernommener Dienst legt Verweise auf Dateien außerhalb des Auftrags ab
  const draussen = mkdtempSync(join(tmpdir(), 'ap-draussen-'));
  writeFileSync(join(draussen, 'geheim.txt'), FORMULAR);
  writeFileSync(join(draussen, 'geheim.pdf'), '%PDF-1.7 fremde Datei');
  symlinkSync(join(draussen, 'geheim.txt'), join(w.ordner, id, 'text.txt'));
  symlinkSync(join(draussen, 'geheim.pdf'), join(w.ordner, id, 'seite-1.pdf'));
  writeFileSync(join(w.ordner, id, 'fertig'), 'modell=nein\nquelle=pdf\n');
  const s = koerper(await ruf(w.u, 'GET', `${pfad}/${id}`, { cookies: c }));
  assert.deepEqual([s.status, s.wochen.length], ['fertig', 0], 'der Text hinter dem Verweis kommt nicht in die Vorschau');
  // auch ein ganzer Auftragsordner als Verweis zählt nicht
  const fremd = 'f'.repeat(32);
  mkdirSync(join(draussen, 'auftrag'));
  writeFileSync(join(draussen, 'auftrag', 'wer'), String(w.anna.id));
  writeFileSync(join(draussen, 'auftrag', 'art'), 'berichtsheft');
  symlinkSync(join(draussen, 'auftrag'), join(w.ordner, fremd));
  assert.equal((await ruf(w.u, 'GET', `${pfad}/${fremd}`, { cookies: c })).status, 404);
});
