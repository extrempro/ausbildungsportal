# Sicherheitsprüfung nach OWASP ASVS

Stand: 21.11.2026 · geprüft an Version 0.74.1, Korrekturen in 0.74.2

Grundlage ist der [OWASP Application Security Verification Standard (ASVS) 4.0](https://owasp.org/www-project-application-security-verification-standard/), **Level 2** – der übliche Maßstab für Anwendungen mit personenbezogenen Daten. Die Übersicht nach den OWASP Top 10 steht in [sicherheit-owasp.md](sicherheit-owasp.md), die Hinweise für den Betrieb in [SECURITY.md](../SECURITY.md).

## Was geprüft wurde

- **Build:** Produktions-Build (`npm run build`), Server mit `NODE_ENV=production` auf einer eigenen Datenbank, lokal über HTTP (im Betrieb steht ein Reverse Proxy mit HTTPS davor).
- **Rollen und Konten (alle erfunden):** zwei Azubis, zwei Ausbilder (je für einen der Azubis zuständig), zwei Ausbildungsbeauftragte (eine zugewiesen, einer niemandem), der Super-Admin. Eine Installation gehört zu einem Betrieb – Mandanten gibt es nicht; die Trennung liegt zwischen den Azubis und zwischen den Zuständigkeiten.
- **Daten:** Plan-Einträge, Bericht mit Foto, Urlaubsanträge, Rückmeldungen aller drei Arten, Lernstand mit Notiz, Kalender-Abo.
- **Vorgehen:**
  1. Bestandsaufnahme im Code: 150 Routen, davon 9 ohne Anmeldung; Uploads (Bericht-Anhänge, Lerninhalte als ZIP, Logo); ausgehende Verbindungen (Entra, Microsoft Graph, Teams-Webhook, SMTP – alle Ziele nur aus der `.env`).
  2. Eigene Prüfung mit echten Anfragen gegen die laufende Instanz (curl, Playwright), nach ASVS-Kapiteln.
  3. Unabhängiger Prüfer: ein eigener Agent, der nur Adresse, Zugänge je Rolle und den Pfad zum Code bekam – keine eigenen Funde, keine Absichten, keine Doku-Bewertungen – und die Instanz selbst angegriffen hat.
  4. Jeden Fund selbst nachgeprüft, Schwere bewertet, behebbare Funde mit Test korrigiert.
- **Dauerhaft im Repository:** `server/test/owasp.test.ts` (jede Route mit fremden Kennungen, kein GET ändert etwas), `server/test/api.test.ts` (jede Route mit jeder Rolle), CI mit `npm audit`, CodeQL und Dependabot.

## Funde und Korrekturen (eigene Prüfung)

| # | Fund | Schwere | Stand |
| --- | --- | --- | --- |
| E1 | **SVG-Filter für Lerninhalte ließ verschleierte Adressen und eingebettete Dokumente durch.** `javascript:` mit Zeichenreferenzen geschrieben (`java&#115;cript:`, `javascript&colon;`) in `<animate>`/`<set>` sowie `<iframe srcdoc>`, `<style>`, `<embed>`, `<object>` blieben stehen. Im Browser blockiert die Content-Security-Policy die Ausführung (geprüft mit Chromium: „Executing inline script violates … script-src 'self'“) – es fehlte also eine von zwei Schutzschichten. Voraussetzung wäre zudem ein präpariertes Inhaltspaket, das ein Ausbilder einreicht und der Super-Admin übernimmt, oder Zugriff auf den Ordner der Lerninhalte. | niedrig | **behoben** in 0.74.2: Zeichenreferenzen werden vor der Prüfung aufgelöst, betroffene Werte geleert; `iframe`, `frame`, `embed`, `object`, `style` werden entfernt. Test in `server/test/lernen.test.ts` (acht neue Umgehungen). Die vorhandenen Grafiken nutzen nichts davon. |
| E2 | **Kein zweiter Faktor für den lokalen Super-Admin.** ASVS Level 2 erwartet für Konten mit weitreichenden Rechten einen zweiten Faktor. | niedrig | **bewusst so, mit Ausgleich:** Der Super-Admin sieht keine Pläne, Berichte oder Lernstände. Passwort mindestens 14 Zeichen, Sperre nach 5 Fehlversuchen, Begrenzung je IP, jeder Fehlversuch mit IP im Protokoll. `SECURITY.md` beschreibt, wie die Passwort-Anmeldung am Reverse Proxy auf das eigene Netz beschränkt wird. Alle anderen Konten melden sich über Entra an – dort gilt der zweite Faktor über den bedingten Zugriff (vom Betreiber bestätigt, 18.11.2026). |
| E3 | **Kein Abgleich neuer Passwörter mit Listen bekannter, geleakter Passwörter** (ASVS 2.1.7). | niedrig | **offen** – betrifft nur das eine lokale Konto (mindestens 14 Zeichen). Siehe „Offene Punkte“. |
| E4 | **Dritte können den Super-Admin aussperren:** Fünf falsche Passwörter mit seinem Benutzernamen sperren das Konto für 15 Minuten. | Info | **bewusst so:** Die Sperre schützt vor dem Erraten. Wer die Passwort-Anmeldung wie in `SECURITY.md` nur aus dem eigenen Netz zulässt, schließt Dritte von außen aus. |
| E5 | **Die Version steht in jeder API-Antwort** (`X-App-Version`). | Info | **bewusst so:** Daran erkennt eine geöffnete Oberfläche ein Update. Das Repository ist öffentlich, die Version also ohnehin bekannt. |

## Funde des unabhängigen Prüfers

Der Prüfer hat **keine ausnutzbare Schwachstelle** bestätigt – keinen Fund hoher, mittlerer oder niedriger Schwere. Zwei Hinweise:

| # | Hinweis | Schwere | Stand |
| --- | --- | --- | --- |
| P1 | Lokal über HTTP: kein HSTS, Cookie ohne `__Host-` und `Secure`. | Info | **so vorgesehen:** Mit `APP_URL=https://…` setzt das Portal `__Host-ap_sitzung`, `Secure` und HSTS selbst. Hängt daran, dass der Reverse Proxy HTTPS erzwingt (vom Betreiber bestätigt). |
| P2 | Kurze Signaturprüfung bei GIF, WebP und HEIC (`GIF8`, `RIFF…WEBP`, `ftyp`) – eine Datei, die zugleich Bild und etwas anderes ist, wäre denkbar. | Info | **akzeptiert:** Bilder gehen nur mit festem `Content-Type: image/…` und `nosniff` hinaus, alles andere nur als Download (`attachment`); dazu die strenge CSP. Nicht ausnutzbar. |

Den Fund E1 hat der Prüfer nicht gemeldet; er hat die Bereinigung zusammen mit der CSP als ausreichend bewertet.

## Ohne Fund geprüft

- **Zugriff:** jede Rolle gegen fremde Azubis (Plan, Berichte, Anhänge, Urlaub, Profil, Bild) → 404; nicht zugewiesene Beauftragte und nicht zuständige Ausbilder sehen nichts; Super-Admin hat keinen Zugriff auf Pläne, Berichte, Urlaub, Lernstand (403); keine Rechteausweitung (Ausbilder legt kein Admin-Konto an, ändert keine fremden Konten).
- **Private Daten der Azubis:** Lernstand und Notizen nur für den Azubi selbst (auch der zuständigen Ausbilderin 403); private Termine nicht für Ausbilder; Wünsche zu Lerninhalten ohne Person.
- **Sitzungen:** Abmelden macht das Token sofort ungültig; Sperre des Kontos beendet alle Sitzungen; Token 256 Bit, in der Datenbank nur als Hash; Leerlauf 8 Stunden, höchstens 24.
- **Anmeldung:** gleiche Antwort und Rechenzeit für unbekannte Konten (keine Aufzählung von Konten); Entwicklungsanmeldung im Betrieb 404.
- **CSRF und CORS:** schreibende Anfragen ohne oder mit fremdem `Origin` → 403, andere Inhaltstypen als JSON → 400; keine CORS-Freigaben, keine Preflights; kein GET ändert etwas.
- **XSS:** alle API-Antworten JSON, React maskiert jede Ausgabe; die einzige Stelle mit HTML-Einbettung sind die SVGs der Lerninhalte (E1); Fehlertexte der Anmeldung nur aus einer festen Liste.
- **Injection:** SQL nur mit Platzhaltern; Kalender-Export maskiert nach RFC 5545 (Zeilenumbrüche aus Eingaben werden zu `\n`, getestet mit `\r`); PDF schreibt Texte als Hex-Zeichenketten; Mail-Kopfzeilen einzeilig.
- **Dateien:** kein Zugriff außerhalb des Ordners der Oberfläche (`../`, `%2e%2e`, Backslash, überlanges UTF-8); ZIP ohne Pfade nach außen, mit Grenzen für Größe und Zahl; Anhänge am Dateianfang geprüft, Downloads mit `Content-Disposition: attachment` und `nosniff`.
- **SSRF:** Ziele ausgehender Verbindungen nur aus der `.env`, Weiterleitungen beim Abruf verboten.
- **Weiterleitungen:** nur feste Ziele (`/`, `/anmelden?fehler=…`).
- **Header und Fehler:** CSP ohne `unsafe-inline`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP, `Permissions-Policy` – auch auf 404- und Fehlerantworten; 500 nur mit „Interner Fehler“.
- **Geschäftslogik:** Azubis legen keine Schul- oder Einsatz-Einträge an und genehmigen keinen Urlaub; abgezeichnete Berichte gesperrt; Stunden begrenzt.
- **Abhängigkeiten:** `npm audit` in der CI auf `main` grün (21.11.2026); Dependabot hält Pakete, Docker-Abbild und Actions aktuell.

## Stand je ASVS-Kapitel

| Kapitel | Stand | Umsetzung und Belege |
| --- | --- | --- |
| V1 Architektur | erfüllt | Ein Einstieg für alle Anfragen (`behandle` in `server/api.ts`), Rechte zentral in `server/rechte.ts`, jede Route mit `wer`. Wenige Pakete im Betrieb, Lockfile mit Prüfsummen. |
| V2 Authentifizierung | teilweise | Entra mit PKCE, `state` (an den Browser gebunden, einmalig) und `nonce`. Super-Admin: scrypt, mindestens 14 Zeichen, Sperre und Begrenzung je IP. Offen: zweiter Faktor (E2, ausgeglichen) und Abgleich mit geleakten Passwörtern (E3). |
| V3 Sitzungen | erfüllt | Zufälliges Token, nur als Hash gespeichert; `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`; neue Sitzung je Anmeldung; Abmelden, Sperre und Passwortwechsel beenden Sitzungen; Leerlauf und Höchstdauer. |
| V4 Zugriffskontrolle | erfüllt | Fremde Kennung → 404, falsche Rolle → 403, für jede Route im Test; private Daten ohne Route für andere; CSRF über `Origin`. |
| V5 Validierung, Ausgabe | erfüllt | Eingaben mit Länge und ohne Steuerzeichen (`text()`), Platzhalter in SQL, React-Ausgabe, SVG-Bereinigung (seit 0.74.2 auch gegen Zeichenreferenzen), Links nur `http(s)://`. |
| V6 Kryptografie | erfüllt | scrypt mit OWASP-Werten, Vergleich in konstanter Zeit, Zufall aus `crypto.randomBytes`; Geheimnis im Kalender-Link 256 Bit. |
| V7 Fehler und Protokoll | erfüllt | Anmeldungen, Fehlversuche mit IP und Änderungen an Konten und Rechten im Protokoll, Löschung nach 90 Tagen; keine Geheimnisse im Log; Fehlerantworten ohne Interna. Abgelehnte Zugriffe werden bewusst nicht protokolliert (siehe sicherheit-owasp.md). |
| V8 Datenschutz | erfüllt | Private Daten der Azubis nur für sie selbst; Wünsche zu Lerninhalten ohne Person; `Cache-Control: no-store` für API und Dateien; Benachrichtigungen ohne fremde Namen. |
| V9 Kommunikation | beim Betreiber | TLS am Reverse Proxy (bestätigt 18.11.2026); HSTS setzt das Portal bei `https://`. Ausgehend: Teams nur `https://`, SMTP mit STARTTLS oder TLS, Anmeldung am Mailserver nur verschlüsselt. |
| V10 Schadcode | erfüllt | Keine dynamische Code-Ausführung; Lockfile, `npm ci`, CodeQL, Dependabot, Secret Scanning. |
| V11 Geschäftslogik | erfüllt | Abläufe (Bericht einreichen, abzeichnen, Urlaub bestätigen und genehmigen) prüfen Rolle und Zuständigkeit auf dem Server; Begrenzung der Anmeldeversuche. |
| V12 Dateien | erfüllt | Größen- und Zahlgrenzen, Typ am Dateianfang, ZIP ohne Pfade nach außen, Auslieferung nur nach Rechteprüfung, `nosniff`, Downloads als Anhang. |
| V13 API | erfüllt | Nur JSON mit `Content-Type`-Prüfung, Anfragen höchstens 256 KB (Uploads eigene Grenzen), unbekannte Methoden 405, keine CORS-Freigaben. |
| V14 Konfiguration | erfüllt | Sicherheits-Header auf allen Antworten; Container als Benutzer `node`, `no-new-privileges`, nur nötige Linux-Rechte, Port nur an 127.0.0.1; `DEV_ANMELDUNG` wirkt im Betrieb nicht; Geheimnisse nur in `.env`; Node 26 (LTS). |

## Offene Punkte

- **E3 – Passwörter gegen Listen geleakter Passwörter prüfen:** entweder über die Schnittstelle von „Have I Been Pwned“ (k-Anonymität, nur die ersten fünf Zeichen des SHA-1-Hashes gehen hinaus – braucht ausgehenden Zugang) oder mit einer mitgelieferten Liste häufiger Passwörter. Zu entscheiden beim Betreiber; bis dahin ein Passwortmanager für das Super-Admin-Passwort.
- **Beim Betrieb zu setzen** (steht in `SECURITY.md`): `APP_URL` mit `https://`, `TRUST_PROXY=true` hinter dem Reverse Proxy, Passwort-Anmeldung `POST /api/auth/lokal` am Proxy auf das eigene Netz beschränken.
- **Auf GitHub ansehen:** offene Meldungen von Dependabot und CodeQL (Reiter „Security“) – aus der Prüfumgebung nicht lesbar.

## Nicht geprüft

- Die Anmeldung über einen echten Entra-Mandanten, Profilbild aus Microsoft Graph (nur im Code gelesen).
- Echter Mailversand und echte Teams-Webhooks (nur im Code gelesen).
- Reverse Proxy, TLS und `__Host-`-Cookies im echten Betrieb.
- Die Sperre nach fünf Fehlversuchen bis zum Auslösen am echten Konto (im Code und in den Tests geprüft).
- Lokal lief die Prüfung mit Node 22; die CI prüft mit Node 26.

Diese Prüfung ersetzt keinen Penetrationstest durch Dritte. Nach größeren Änderungen – neue Rollen, neue Uploads, neue ausgehende Verbindungen, neue öffentliche Routen – wiederholen.
