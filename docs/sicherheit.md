# Sicherheitsprüfung nach OWASP ASVS

Stand: 24.11.2026 · Nachprüfung an Version 0.83.1, Korrekturen in 0.83.2 (vorher: 21.11.2026 an 0.74.2)

**Grundlage: OWASP ASVS 5.0.0, Level 2** (vorher 4.0.3) – der [Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/), Level 2 ist der übliche Maßstab für Anwendungen mit personenbezogenen Daten. Die Übersicht nach den OWASP Top 10 steht in [sicherheit-owasp.md](sicherheit-owasp.md), die Hinweise für den Betrieb in [SECURITY.md](../SECURITY.md).

## Was geprüft wurde

- **Build:** Produktions-Build (`npm run build`), Server mit `NODE_ENV=production` auf einer eigenen Datenbank, lokal über HTTP (im Betrieb steht ein Reverse Proxy mit HTTPS davor). Die HTTPS-Einstellungen (`__Host-`-Cookie, `Secure`, HSTS) sind in `server/test/http.test.ts` mit `APP_URL=https://…` geprüft.
- **Rollen und Konten (alle erfunden):** zwei Azubis, zwei Ausbilder (je für einen der Azubis zuständig), zwei Ausbildungsbeauftragte (eine zugewiesen, einer niemandem), der Super-Admin. Eine Installation gehört zu einem Betrieb – Mandanten gibt es nicht; die Trennung liegt zwischen den Azubis und zwischen den Zuständigkeiten.
- **Daten:** Plan-Einträge, Bericht mit Foto, Urlaubsanträge, Rückmeldungen aller drei Arten, Lernstand mit Notiz, Kalender-Abo.
- **Vorgehen:**
  1. Bestandsaufnahme im Code: 150 Routen, davon 9 ohne Anmeldung; Uploads (Bericht-Anhänge, Lerninhalte als ZIP, Logo); ausgehende Verbindungen (Entra, Microsoft Graph, Teams-Webhook, SMTP – alle Ziele nur aus der `.env`).
  2. Eigene Prüfung mit echten Anfragen gegen die laufende Instanz (curl, Playwright), nach ASVS-Kapiteln.
  3. Unabhängiger Prüfer: ein eigener Agent, der nur Adresse, Zugänge je Rolle und den Pfad zum Code bekam – keine eigenen Funde, keine Absichten, keine Doku-Bewertungen – und die Instanz selbst angegriffen hat. Bei der Nachprüfung nach 5.0 ein neuer Prüfer, ebenfalls ohne Vorwissen.
  4. Jeden Fund selbst nachgeprüft, Schwere bewertet, behebbare Funde mit Test korrigiert und den Angriff wiederholt.
- **Dauerhaft im Repository:** `server/test/owasp.test.ts` (jede Route mit fremden Kennungen, kein GET ändert etwas), `server/test/api.test.ts` (jede Route mit jeder Rolle), `server/test/http.test.ts` (Header, Dateien, Typen), CI mit `npm audit`, CodeQL und Dependabot.

## Funde und Korrekturen (eigene Prüfung)

| # | Fund | Schwere | Stand |
| --- | --- | --- | --- |
| E1 | **SVG-Filter für Lerninhalte ließ verschleierte Adressen und eingebettete Dokumente durch.** `javascript:` mit Zeichenreferenzen geschrieben (`java&#115;cript:`, `javascript&colon;`) in `<animate>`/`<set>` sowie `<iframe srcdoc>`, `<style>`, `<embed>`, `<object>` blieben stehen. Im Browser blockiert die Content-Security-Policy die Ausführung (geprüft mit Chromium) – es fehlte also eine von zwei Schutzschichten. Voraussetzung wäre zudem ein präpariertes Inhaltspaket, das ein Ausbilder einreicht und der Super-Admin übernimmt, oder Zugriff auf den Ordner der Lerninhalte. | niedrig | **behoben** in 0.74.2: Zeichenreferenzen werden vor der Prüfung aufgelöst, betroffene Werte geleert; `iframe`, `frame`, `embed`, `object`, `style` werden entfernt. Test in `server/test/lernen.test.ts`. Nachprüfung 21.11.2026: hält. |
| E2 | **Kein zweiter Faktor für den lokalen Super-Admin.** ASVS 5.0 (6.3.3) verlangt auf Level 2 mehrere Faktoren. | niedrig | **bewusst so, mit Ausgleich:** Der Super-Admin sieht keine Pläne, Berichte oder Lernstände. Passwort mindestens 14 Zeichen, Sperre nach 5 Fehlversuchen, Begrenzung je IP, jeder Fehlversuch mit IP im Protokoll. `SECURITY.md` beschreibt, wie die Passwort-Anmeldung am Reverse Proxy auf das eigene Netz beschränkt wird. Alle anderen Konten melden sich über Entra an – dort gilt der zweite Faktor über den bedingten Zugriff (vom Betreiber bestätigt, 18.11.2026). |
| E3 | **Kein Abgleich neuer Passwörter mit Listen bekannter, geleakter Passwörter.** *Berichtigt bei der Nachprüfung:* Eine kleine Liste häufiger Wörter (`passwort`, `qwertz` …, auch mit angehängten Ziffern) und mindestens 14 Zeichen gibt es; die gängigen Listen der häufigsten Passwörter (ASVS 5.0, 6.2.4) bestehen fast nur aus kürzeren. Es fehlt der Abgleich mit Passwörtern aus Datenlecks (6.2.12, Level 2). | niedrig | **bewusst so** (Entscheidung des Betreibers, 21.11.2026): kein Abgleich über „Have I Been Pwned“ – der Server bräuchte dafür ausgehenden Zugang. Betrifft nur das eine lokale Konto; Ausgleich: mindestens 14 Zeichen, Liste häufiger Wörter, Passwortmanager, Passwort-Anmeldung am Proxy nur aus dem eigenen Netz. |
| E4 | **Dritte können den Super-Admin aussperren:** Fünf falsche Passwörter mit seinem Benutzernamen sperren das Konto für 15 Minuten. | Info | **bewusst so:** Die Sperre schützt vor dem Erraten. Wer die Passwort-Anmeldung wie in `SECURITY.md` nur aus dem eigenen Netz zulässt, schließt Dritte von außen aus. |
| E5 | **Die Version steht in jeder API-Antwort** (`X-App-Version`). | Info | **bewusst so:** Daran erkennt eine geöffnete Oberfläche ein Update. Das Repository ist öffentlich, die Version also ohnehin bekannt. |
| E6 | **Kurze Fehlertexte außerhalb der API ohne `Content-Type`** (400 „Ungültige Adresse“, 404 für fehlende Dateien, 405, die Ausweich-Antwort bei 500). ASVS 5.0, 4.1.1 verlangt Typ samt Zeichensatz bei jeder Antwort mit Inhalt. Mit `nosniff` nicht ausnutzbar. | niedrig | **behoben** in 0.74.3: `text/plain; charset=utf-8` bzw. `application/json; charset=utf-8`. Test in `server/test/http.test.ts`, live wiederholt. |
| E7 | **HSTS ohne `includeSubDomains`.** ASVS 5.0, 3.4.1 verlangt auf Level 2, dass die Regel auch für Unteradressen gilt. | niedrig | **behoben** in 0.74.3: `max-age=31536000; includeSubDomains`. Betrifft nur Adressen unterhalb der Adresse des Portals (z. B. `*.ausbildung.firma.de`), nicht andere Adressen der Firma. Test in `server/test/http.test.ts`. |
| E8 | **Zeilen ins Server-Log einschleusbar.** Beim Rücksprung von Microsoft schreibt das Portal den Parameter `error` ins Log; wer selbst eine Anmeldung beginnt, kann dort Zeilenumbrüche mitschicken und so echt aussehende Log-Zeilen erzeugen (z. B. „Super-Admin … angelegt“). Nur mit eingerichteter Microsoft-Anmeldung erreichbar, ohne Zugriff auf Daten. | niedrig | **behoben** in 0.74.3: Jede Log-Ausgabe läuft über `sichererLog` (`server/start.ts`) – Steuerzeichen werden zu „?“, jede weitere Zeile einer Meldung wird eingerückt; Stacktraces bleiben lesbar. Test in `server/test/log.test.ts`. |
| E9 | **CSP mit `base-uri 'self'`.** ASVS 5.0, 3.4.3 verlangt mindestens `object-src 'none'` und `base-uri 'none'`. | niedrig | **behoben** in 0.74.3: `base-uri 'none'` (das Portal nutzt kein `<base>`). Test in `server/test/http.test.ts`. |

## Funde des unabhängigen Prüfers

Beide Prüfer haben **keine ausnutzbare Schwachstelle** bestätigt – keinen Fund hoher, mittlerer oder niedriger Schwere. Hinweise:

| # | Hinweis | Schwere | Stand |
| --- | --- | --- | --- |
| P1 | Lokal über HTTP: kein HSTS, Cookie ohne `__Host-` und `Secure`. | Info | **so vorgesehen:** Mit `APP_URL=https://…` setzt das Portal `__Host-ap_sitzung`, `Secure` und HSTS selbst. Hängt daran, dass der Reverse Proxy HTTPS erzwingt (vom Betreiber bestätigt). |
| P2 | Kurze Signaturprüfung bei GIF, WebP und HEIC (`GIF8`, `RIFF…WEBP`, `ftyp`) – eine Datei, die zugleich Bild und etwas anderes ist, wäre denkbar. | Info | **akzeptiert:** Bilder gehen nur mit festem `Content-Type: image/…` und `nosniff` hinaus, alles andere nur als Download (`attachment`); dazu die strenge CSP. Nicht ausnutzbar. |
| P3 | Die SVG-Bereinigung arbeitet mit Mustern statt mit einem Parser – grundsätzlich spröder. | Info | **akzeptiert:** Die CSP ist die tragende Schutzschicht (`script-src 'self'` ohne `unsafe-inline`), die Bereinigung die zweite (seit E1 auch gegen Zeichenreferenzen). Ein Parser wäre eine neue Abhängigkeit. |
| P4 | Das Quiz liefert die richtigen Antworten mit der Frage an den Browser. | Info | **so gewollt:** Selbstlernen mit sofortiger Rückmeldung; es geht nur um den eigenen, privaten Lernstand. |
| P5 | Versionsnummer in jeder API-Antwort. | Info | wie E5. |

Den Fund E1 hat der erste Prüfer nicht gemeldet; die Funde E6 bis E9 kamen erst mit ASVS 5.0 dazu.

## Nachprüfung nach ASVS 5.0 (21.11.2026)

Vollständige Prüfung über alle Kapitel von 5.0 an Version 0.74.2, dazu die alten Funde gegengeprüft: E1 hält (Test und Nachprüfung im Code), E2 bis E5 und P1, P2 unverändert. Neu: E6 bis E9 (behoben), P3 bis P5 (Hinweise). E3 berichtigt (siehe oben).

**Ohne Fund geprüft (beide Prüfungen):**

- **Zugriff:** jede Rolle gegen fremde Azubis (Plan, Berichte, Anhänge, Urlaub, Profil, Bild) → 404; nicht zugewiesene Beauftragte und nicht zuständige Ausbilder sehen nichts; Super-Admin ohne Zugriff auf Pläne, Berichte, Urlaub, Lernstand (403); keine Rechteausweitung.
- **Private Daten der Azubis:** Lernstand und Notizen nur für den Azubi selbst (auch der zuständigen Ausbilderin 403); private Termine nicht für Betreuende; Wünsche zu Lerninhalten ohne Person.
- **Sitzungen:** Abmelden macht das Token sofort ungültig; Sperre des Kontos und Passwortwechsel beenden Sitzungen; Token 256 Bit, in der Datenbank nur als Hash.
- **Anmeldung:** gleiche Antwort und Rechenzeit für unbekannte Konten; Passwortwechsel nur mit dem bisherigen Passwort; Entwicklungsanmeldung im Betrieb 404.
- **OIDC (im Code):** Authorization Code mit PKCE (S256); `state` an den Browser gebunden und einmalig, `nonce` geprüft; feste Redirect-URI aus `APP_URL`; ID-Token nur mit RS256, Signatur, Aussteller, Empfänger und Ablauf über `openid-client`, Mandant (`tid`) geprüft; das Zugriffstoken dient nur einmal für das Profilbild und wird nicht gespeichert; keine Tokens in URLs, Logs oder im Browser.
- **CSRF und CORS:** schreibende Anfragen ohne oder mit fremdem `Origin` → 403; keine CORS-Freigaben; kein GET ändert etwas.
- **XSS:** alle API-Antworten JSON, React maskiert jede Ausgabe; einzige HTML-Einbettung sind die SVGs der Lerninhalte (E1, P3).
- **Injection:** SQL nur mit Platzhaltern; Kalender-Export nach RFC 5545 maskiert; PDF mit Hex-Zeichenketten; Mail-Kopfzeilen einzeilig.
- **Dateien:** kein Zugriff außerhalb des Ordners der Oberfläche; keine `.env`, kein `.git`, keine Quelltextkarten; ZIP ohne Pfade nach außen und mit Grenzen; Anhänge am Dateianfang geprüft, Downloads als Anhang mit `nosniff`.
- **SSRF, Weiterleitungen:** Ziele nur aus der `.env`, Weiterleitungen beim Abruf verboten; Rücksprünge nur auf feste Ziele.
- **Header und Fehler:** CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, COOP/CORP, `Permissions-Policy` auf allen Antworten; `HEAD`, `OPTIONS`, `TRACE` an der API → 405; 500 nur „Interner Fehler“.
- **Daten im Browser:** `localStorage` nur für Ansichts-Einstellungen (Farbschema, aufgeklappte Hilfen, Führung gesehen), keine Inhalte; der Service Worker speichert nur die Offline-Seite; API-Antworten `no-store`.
- **Logging:** keine Passwörter, Tokens, Sitzungs-IDs oder Geheimnisse im Log.
- **Geschäftslogik:** Azubis legen keine Schul- oder Einsatz-Einträge an und genehmigen keinen Urlaub; abgezeichnete Berichte gesperrt; Stunden begrenzt.
- **Abhängigkeiten:** `npm audit` in der CI grün; Dependabot hält Pakete, Docker-Abbild und Actions aktuell.

## Nachprüfung 24.11.2026 (Version 0.83.1)

Gezielt geprüft, was seit 0.74.3 dazugekommen ist: Anmeldung in der Teams-App (`POST /api/auth/teams`, `/teams/app`), angemeldete Geräte (`/api/ich/sitzungen`), Klassen und Schulblöcke, Einlesen von Schulplänen und alten Berichten über den Dienst „import“, Wochenende im Berichtsheft, Einsatzwünsche, Erinnerungen und Zeitleiste (35 neue Routen, jetzt 185). Gleicher Aufbau wie zuvor: Produktions-Build mit eigener Datenbank, zwei Azubis, zwei Ausbilder, zwei Beauftragte (eine zugewiesen, einer nicht), Super-Admin; Teams-App und Entra mit erfundenen Kennungen eingeschaltet (ohne Verbindung zu Microsoft). Der Dienst „import“ lief nicht; seine Antworten wurden im Austauschordner nachgestellt – auch so, als wäre er übernommen.

| # | Fund | Schwere | Stand |
| --- | --- | --- | --- |
| E10 | **Verweise (Symlinks) aus dem Dienst „import“ wurden gelesen.** Der Dienst verarbeitet fremde PDFs in einem abgeschotteten Container und schreibt nach `data/import`. Wäre er über eine Lücke in den Lesewerkzeugen übernommen, hätte er statt `text.txt` oder `seite-1.pdf` einen Verweis auf eine Datei der App ablegen können; die App folgte ihm. Nachgestellt: Eine Textdatei außerhalb des Auftrags erschien in der Vorschau des Azubis. Ausnutzbar nur mit einer zweiten Lücke; Seiten müssen ohnehin mit `%PDF-` beginnen, Text erscheint nur, soweit er wie ein Bericht aussieht. | niedrig | **behoben** in 0.83.2: Dateien des Dienstes nur als echte Datei (`O_NOFOLLOW`, Prüfung auf reguläre Datei, Größengrenze), Auftragsordner nur als echter Ordner (`liesRoh` in `server/import-dienst.ts`). Test in `server/test/berichtsheft-import.test.ts`, Angriff wiederholt. |
| E11 | **Erinnerungen zeigten den Plan weiter, nachdem der Zugriff endete.** Eine Beauftragte, deren Zuweisung endete, sah über ihre Erinnerung „vor einem Einsatz“ weiter Titel und neue Tage des Einsatzes, wenn er umbenannt oder verschoben wurde. | niedrig | **behoben** in 0.83.2: Sieht die Person den Azubi (oder den Einsatz) nicht mehr, löst sich die Erinnerung vom Einsatz und behält ihren letzten Tag. Test in `server/test/erinnerung.test.ts`. |
| E12 | **PDF alter Berichte kam nicht an** (kein Sicherheitsfund): `POST /api/azubis/:id/einlesen` mit `application/pdf` lief in „Anfrage muss gültiges JSON sein“ – der Webserver ließ PDFs nur beim Schulplan durch. | Info | **behoben** in 0.83.2: beide Pfade, Grenze 11 MB vor der Prüfung in der API (10 MB). Test in `server/test/http.test.ts`. |

**Unabhängiger Prüfer:** ein neuer Agent ohne Vorwissen (nur Adresse, Zugänge je Rolle, Pfad zum Code) hat die Instanz mit 0.83.1 und den Korrekturen für E10 und E12 angegriffen – **kein Fund**. Er hat den nachgestellten Symlink-Angriff selbst wiederholt (auch über „übernehmen“ mit Originalseite): kein fremder Text, kein fremder Anhang. Hinweise:

| # | Hinweis | Schwere | Stand |
| --- | --- | --- | --- |
| P6 | Die SVG-Bereinigung der Lerninhalte ist eine Sperrliste. | Info | wie P3 – kein Durchbruch gefunden, die CSP trägt. |
| P7 | Die Testinstanz lief als `root`. | Info | **nur in der Prüfumgebung:** Im Container startet das Skript als root, richtet den Datenordner ein und wechselt dann zum Benutzer `node` (V13); der Dienst „import“ läuft als eigener Benutzer ohne Rechte. |

**Ohne Fund geprüft:**

- **Einsatzwünsche:** fremder Azubi und nicht zuständiger Ausbilder → 404, Beauftragte und Super-Admin → 403, auch nicht in der Glocke; Status, Einsatz und Entscheidung lassen sich beim Anlegen nicht mitschicken; Zeiträume begrenzt; Grund nicht im Plan.
- **Erinnerungen:** fremde Erinnerung lesen, abhaken, löschen → 404; nur Azubis, die man sieht (bzw. künftige Zuweisung, siehe Entscheidungen); fremde Einsätze → 400; Steuerzeichen abgelehnt; Glocke nur für die Person selbst.
- **Teams-Anmeldung:** Token mit `alg: none`, `HS256`, fremdem oder fehlendem Schlüssel, falscher Form → 401 (im Protokoll); ohne `Origin` → 403. `/teams/app`: Ziel nur als eigener Pfad (`javascript:`, `//…`, `/\…`, eingeschleustes HTML → Startseite), eigene CSP ohne Skripte von außen.
- **Angemeldete Geräte:** fremde Sitzung über ihre Kennung beenden → 404; Gerät nur als Browser und System.
- **Einlesen:** Aufträge anderer Personen und anderer Art → 404; andere Rollen → 403; Kennung nur 32 Hex-Zeichen.

## Stand je ASVS-Kapitel (5.0)

| Kapitel | Stand | Umsetzung und Belege |
| --- | --- | --- |
| V1 Encoding und Sanitization | erfüllt | React maskiert jede Ausgabe; SQL mit Platzhaltern; ICS und Mail-Kopfzeilen maskiert; PDF als Hex; SVG-Bereinigung (E1) als zweite Schicht hinter der CSP. |
| V2 Validierung und Geschäftslogik | erfüllt | Eingaben serverseitig mit Länge und ohne Steuerzeichen (`text()` in `server/api-basis.ts`), feste Felder je Route; Abläufe (einreichen, abzeichnen, bestätigen, genehmigen) prüfen Rolle und Zuständigkeit; Begrenzung nur bei Anmeldung und Kalender-Abruf (siehe Entscheidungen). |
| V3 Web-Frontend | erfüllt | CSP ohne `unsafe-inline`, `object-src 'none'`, `base-uri 'none'` (E9), `frame-ancestors 'none'` – mit eingeschalteter Teams-App (ab 0.77.0; Schalter beim Super-Admin ab 0.84.0, protokolliert) nur Teams- und Microsoft-365-Adressen, dann ohne `X-Frame-Options`; der Einstieg `/teams/app` enthält keine Daten, lädt nur eigene Skripte, Ziel nur als eigener Pfad; HSTS mit `includeSubDomains` (E7); Cookie `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax` (in der Teams-App ein eigenes Cookie mit `SameSite=None; Partitioned` – nur unter Teams gesendet, CSRF weiter über `Origin`); COOP, CORP, `nosniff`, `Referrer-Policy`; CSRF über `Origin`. |
| V4 API und Web-Services | erfüllt | Nur JSON mit Typprüfung, Antworten mit Typ und Zeichensatz (E6); Grenzen für Anfragen; unbekannte Methoden 405; keine CORS-Freigaben. |
| V5 Dateien | erfüllt | Erlaubte Typen am Dateianfang, Größen- und Zahlgrenzen, ZIP ohne Pfade nach außen und mit Grenze für den entpackten Inhalt; Auslieferung nur nach Rechteprüfung, `nosniff`, Downloads als Anhang; Dateien in der Datenbank, nicht im Dateisystem. |
| V6 Authentifizierung | teilweise | Entra (zweiter Faktor dort). Super-Admin: mindestens 14 Zeichen, höchstens 200, keine Zusammensetzungsregeln, Liste häufiger Wörter, Wechsel nur mit altem Passwort, Sperre und Begrenzung je IP, Startpasswort muss geändert werden. Bewusst nicht: zweiter Faktor für den Super-Admin (E2, ausgeglichen) und Abgleich mit Passwörtern aus Datenlecks (E3, Entscheidung des Betreibers). |
| V7 Sitzungen | erfüllt | Zufälliges Token nur als Hash; neue Sitzung je Anmeldung; Leerlauf 8 Stunden, höchstens 24; Abmelden, Sperre und Passwortwechsel beenden Sitzungen; Warnung vor dem Ende. Seit 0.75.0 unter „Konto“ die eigenen Sitzungen mit Gerät (nur Browser und System), einzeln oder alle anderen abmelden (7.5.2). Abweichung: ohne erneute Anmeldung vor dem Abmelden anderer Geräte (Entscheidung des Betreibers – es ist eine Schutzhandlung). |
| V8 Autorisierung | erfüllt | Rechte zentral (`server/rechte.ts`), jede Route mit `wer`, fremde Kennung → 404, falsche Rolle → 403 – für jede Route im Test. |
| V9 Self-contained Tokens | erfüllt | Das Portal stellt keine eigenen Tokens aus; das ID-Token von Entra prüft `openid-client` (Signatur RS256, Aussteller, Empfänger, Ablauf, `nonce`). |
| V10 OAuth und OIDC | erfüllt | Authorization Code mit PKCE (S256), `state` einmalig und an den Browser gebunden, feste Redirect-URI, Mandant geprüft; Tokens nur im Server, nicht gespeichert; kein Refresh-Token. Gegen einen echten Mandanten nicht geprüft. |
| V11 Kryptografie | erfüllt | scrypt (N = 2¹⁷, OWASP-Werte) mit Vergleich in konstanter Zeit; SHA-256 für Sitzungs-Hashes; Zufall aus `crypto.randomBytes`; keine eigene Kryptografie. Übersicht unter „Dokumentierte Sicherheitsentscheidungen“. |
| V12 Sichere Kommunikation | beim Betreiber | TLS am Reverse Proxy (bestätigt 18.11.2026), HSTS vom Portal. Zwischen Proxy und Container unverschlüsselt über `127.0.0.1` auf demselben Host (Entscheidung). Ausgehend: Teams-Kanal nur `https://`, Microsoft Graph für die Teams-App (Token per Client-Credentials, nur im Speicher, nie im Log), SMTP mit STARTTLS oder TLS, Anmeldung am Mailserver nur verschlüsselt. |
| V13 Konfiguration | erfüllt | Geheimnisse nur in `.env`, nie im Log; keine Quelltextkarten, keine Verzeichnislisten, kein `.git` im Abbild; `DEV_ANMELDUNG` wirkt im Betrieb nicht; Container als Benutzer `node`, `no-new-privileges`, nur nötige Linux-Rechte, Port nur an 127.0.0.1. Version im Header (E5). |
| V14 Datenschutz | erfüllt | Datenklassen und Zugriff festgelegt (siehe Entscheidungen); private Daten der Azubis nur für sie selbst; `no-store`; keine Inhalte im Browser-Speicher; Löschfristen für Protokoll und Rückmeldungen. Das Geheimnis des Kalender-Abos steht zwangsläufig im Link (Kalenderprogramme können sich nicht anmelden). |
| V15 Sicheres Programmieren und Architektur | teilweise | Ein Einstieg für alle Anfragen, wenige Pakete, Lockfile mit Prüfsummen, `npm ci`, CodeQL, Dependabot; keine Massenzuweisung (Felder einzeln gelesen). Fristen für das Schließen bekannter Lücken in Paketen festgelegt (15.1.1, siehe Entscheidungen). |
| V16 Logging und Fehlerbehandlung | teilweise | Protokoll in der Datenbank: Anmeldungen, Fehlversuche mit IP, Änderungen an Konten, Rechten und Einstellungen, Zeit in UTC, 90 Tage. Server-Log ohne Geheimnisse und gegen eingeschleuste Zeilen geschützt (E8). Fehler ohne Interna. Bewusst nicht: abgelehnte Zugriffe (16.3.2, Entscheidung mit Blick auf den Betriebsrat). Beim Betreiber: Log an ein getrenntes System (16.4.3). |
| V17 WebRTC | nicht zutreffend | Das Portal nutzt kein WebRTC. |

## Dokumentierte Sicherheitsentscheidungen

- **Rollen und Rechte:** Azubi (eigene Daten), Ausbildungsbeauftragte (zugewiesene Azubis, im Rahmen der Zuweisung), Ausbilder (zuständige und unbetreute Azubis, Stammdaten), Super-Admin (Konten, Einstellungen, Protokoll, Fehlermeldungen – keine Pläne, Berichte, Lernstände). Einzelheiten in `docs/spec.md` und `server/rechte.ts`.
- **Schützenswerte Daten:**
  - *privat für den Azubi:* Lernstand, Abzeichen, Übungsergebnisse, Planer-Eintragungen (außer Terminen), Begleiter, private Termine, Entwürfe;
  - *personenbezogen, für Betreuende:* Plan, Berichte mit Anhängen, Urlaub, Profil, Profilbild;
  - *ohne Person:* Wünsche zu Lerninhalten;
  - *Geheimnisse:* Webhook-Adresse des Teams-Kanals, SMTP-Zugang, Entra-Schlüssel (nur `.env`), Geheimnis des Kalender-Abos (256 Bit, nur als Link beim Besitzer).
- **Sitzungen:** Ende nach 8 Stunden ohne Anfrage, spätestens nach 24 Stunden; Anmeldevorgang mit Microsoft 10 Minuten gültig. Unter „Konto“ sieht jede Person ihre eigenen Sitzungen (Gerät nur als Browser und System, keine IP-Adresse) und meldet andere Geräte ab – ohne erneute Anmeldung (Entscheidung des Betreibers, 21.11.2026).
- **Fehlversuche:** Super-Admin nach 5 falschen Passwörtern 15 Minuten gesperrt; je IP höchstens 30 Passwort-Anmeldungen und 600 Microsoft-Anmeldungen in 15 Minuten; Kalender-Abruf höchstens 300 je IP in 15 Minuten. Andere Routen sind nicht begrenzt – sie verlangen eine Anmeldung aus dem eigenen Entra-Mandanten.
- **Passwörter:** 14 bis 200 Zeichen, keine Zusammensetzungsregeln, keine erzwungenen Wechsel; scrypt.
- **Dateien:** Plan der Berufsschule als PDF bis 10 MB (nur zum Einlesen, wird danach gelöscht); Anhänge an Berichten nur JPG, PNG, GIF, WebP, HEIC, PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP (ohne Makros), je Datei höchstens 5 MB, 12 je Bericht, zusammen höchstens 30 MB; Logo PNG, JPEG oder WebP bis 150 KB; Lerninhalte als ZIP bis 15 MB, höchstens 600 Dateien, je Datei 5 MB, entpackt 40 MB; jede andere Anfrage höchstens 256 KB.
- **Kryptografie:** scrypt für das Passwort, SHA-256 für Sitzungs-Tokens in der Datenbank, `crypto.randomBytes` für Tokens, `state`, `nonce` und Geheimnisse; TLS am Reverse Proxy; RS256 für ID-Tokens.
- **Protokoll:** Anmeldungen, Fehlversuche (mit IP), Abmeldungen, Änderungen an Konten, Rechten, Zuweisungen und Einstellungen; Aufbewahrung 90 Tage. Erledigte Rückmeldungen werden nach 30 Tagen gelöscht. Abgelehnte Zugriffe werden nicht protokolliert (Begründung in sicherheit-owasp.md). Das Server-Log (Fehler, Start, Ausfälle von Teams und Mail) enthält keine personenbezogenen Inhalte und keine Geheimnisse; seine Zeitstempel setzt Docker.
- **Lücken in Paketen (15.1.1, festgelegt 21.11.2026):** kritisch innerhalb von 3 Tagen, hoch innerhalb von 7 Tagen, mittel innerhalb von 30 Tagen, niedrig mit dem nächsten Update. Gemeldet werden sie von Dependabot und `npm audit` in der CI; gilt für Pakete im Betrieb, das Docker-Abbild und die GitHub Actions.
- **Teams-App (ab 0.77.0):** Nachrichten an einzelne Personen gehen nicht mehr über einen Workflow mit geheimer Adresse (wer sie kannte, konnte jeder Person im Mandanten schreiben), sondern über Microsoft Graph mit der Anwendungsberechtigung `TeamsActivity.Send`. Sie erlaubt nur Meldungen im Aktivitätsfeed über die eigene, im Mandanten verteilte App. Inhalt: kurzer Text ohne Namen, Empfänger ist die Entra-Objekt-ID.
- **Anmeldung in der Teams-App (ab 0.77.0):** Token von Teams (Single Sign-on), geprüft ohne Zusatzpaket: nur RS256 mit Schlüssel des eigenen Mandanten (`kid`), Aussteller und `tid` des Mandanten, Empfänger `api://<Host>/<Client-ID>` oder die Client-ID, `exp`/`nbf` mit 60 s Spielraum, Bereich `access_as_user`, anfordernde App aus einer festen Liste (Teams, Outlook, Microsoft 365). Konto über die Objekt-ID wie bei der Anmeldung im Browser; gesperrte und unbekannte Konten → 403. Begrenzung wie Microsoft-Anmeldungen (600 je IP in 15 Minuten). Fehlversuche stehen im Protokoll.
- **Einbetten (ab 0.77.0):** Mit Teams-App darf das Portal in Teams und Microsoft 365 eingebettet werden. Klickjacking ist damit nur aus diesen Seiten von Microsoft möglich; ohne `TEAMS_APP_ID` bleibt `frame-ancestors 'none'`.
- **Dienst „import“ (ab 0.79.0):** eigener Container ohne Netz, schreibgeschützt, ohne Linux-Rechte, mit Grenzen für CPU, Speicher und Prozesse; Austausch nur über `data/import`. Uploads nur als PDF (Dateianfang `%PDF-`, höchstens 10 MB, höchstens 40 Seiten, Texterkennung höchstens 20 Seiten) und nur für Ausbilder; Aufträge gehören der Person, die sie angelegt hat (fremde Kennung → 404, Kennung nur 32 Hex-Zeichen). Datei und Text werden nach dem Übernehmen gelöscht, spätestens nach 24 Stunden. Die Antwort des Sprachmodells wird wie eine Eingabe von außen geprüft (feste Form, gültige Daten, Klasse muss existieren) und erst nach Bestätigung gespeichert.
- **Alte Berichte einlesen (ab 0.80.0):** dieselben Grenzen; Upload nur durch den Azubi für sich selbst (`eigenerAzubi`, fremde Kennung → 404, andere Rollen → 403). Aufträge sind je Art getrennt (`art` in der Auftragsdatei) – ein Auftrag für alte Berichte ist über die Routen des Schulplans nicht erreichbar und umgekehrt. Übernommenes läuft durch dieselbe Prüfung wie ein gespeicherter Bericht (`pruefeInhalt`) und wird nur für Wochen ohne Bericht, innerhalb der Ausbildungszeit und nicht in der Zukunft angelegt. Originalseiten: nur Dateien `seite-<Zahl>.pdf` aus dem eigenen Auftrag, Dateianfang `%PDF-`, höchstens 5 MB, höchstens 4 je Bericht. Entwürfe bleiben privat, bis der Azubi sie einreicht.
- **Erinnerungen (ab 0.83.0):** privat für die Person, die sie anlegt; fällige in ihrer Glocke, per Teams und E-Mail ohne Namen und Text. Beauftragte dürfen sie schon vor einer künftigen Zuweisung anlegen (Entscheidung des Betreibers, 24.11.2026) – dann sehen sie dort Namen und die Einsätze in ihrer Abteilung, sonst nichts aus dem Plan. Endet der Zugriff, löst sich die Erinnerung vom Einsatz (E11).
- **Einsatzwünsche (ab 0.83.0):** sichtbar für den Azubi und Ausbilder, die ihn sehen; entscheiden kann nur, wer ihn verwaltet. Nicht für Beauftragte, auch nicht in der Glocke.
- **Interne Verbindung:** Reverse Proxy und Container auf demselben Host, Verbindung über `127.0.0.1` ohne TLS.

## Offene Punkte

- **Beim Betrieb zu setzen** (steht in `SECURITY.md`): `APP_URL` mit `https://`, `TRUST_PROXY=true` hinter dem Reverse Proxy, Passwort-Anmeldung `POST /api/auth/lokal` am Proxy auf das eigene Netz beschränken; das Container-Log an ein getrenntes System weitergeben (16.4.3), z. B. über den Logging-Treiber von Docker.
- **Auf GitHub ansehen:** offene Meldungen von Dependabot und CodeQL (Reiter „Security“) – aus der Prüfumgebung nicht lesbar.

## Nicht geprüft

- Die Anmeldung über einen echten Entra-Mandanten, Profilbild aus Microsoft Graph (nur im Code gelesen).
- Echter Mailversand und echte Teams-Webhooks (nur im Code gelesen); die Teams-App mit einem echten Mandanten (Versand über Graph, Anmeldung über Teams, Portal in Teams am PC, im Browser und am Handy, Cookie unter Teams in Safari am iPhone).
- Reverse Proxy, TLS und `__Host-`-Cookies im echten Betrieb.
- Die Sperre nach fünf Fehlversuchen bis zum Auslösen am echten Konto (im Code und in den Tests geprüft).
- Lokal lief die Prüfung mit Node 22 und TypeScript 6; die CI prüft mit Node 26 und TypeScript 7.

Diese Prüfung ersetzt keinen Penetrationstest durch Dritte. Nach größeren Änderungen – neue Rollen, neue Uploads, neue ausgehende Verbindungen, neue öffentliche Routen – wiederholen.
