# Sicherheit nach OWASP Top 10

Stand: 13.11.2026 · Durchsicht an Version 0.64.0, Maßnahmen in 0.65.0

Maßstab sind die [OWASP Top 10:2025](https://owasp.org/Top10/2025/) – die zehn häufigsten Schwachstellen von Webanwendungen. Was beim Betrieb zu beachten ist (HTTPS, VPN, Schutz der Super-Admin-Anmeldung am Reverse Proxy), steht in [SECURITY.md](../SECURITY.md).

## Wie geprüft wurde

- **Wer:** eine Durchsicht durch den Entwickler (hier: Claude), kein Penetrationstest durch Dritte.
- **Code:** Server vollständig auf Datenbankzugriffe, Rechte, Sitzung, Anmeldung, Uploads, Kopfzeilen, Protokoll und Fehlerbehandlung durchgesehen; dazu Docker und CI.
- **Im Test, dauerhaft:** `server/test/owasp.test.ts` ruft jede Route mit Kennung als Fremder auf (anderer Azubi, nicht zugewiesene Beauftragte, nicht zuständiger Ausbilder) – gegen echte Daten eines Azubis: Plan-Eintrag, Urlaubsantrag, Bericht, Anhang, Konto. Und: Kein GET ändert etwas in der Datenbank, für jede Rolle. `server/test/api.test.ts` prüft jede Route mit jeder Rolle.
- **In der CI, dauerhaft:** Job `abhaengigkeiten` (`npm audit` für die Pakete im Betrieb, ab „hoch“); der Docker-Job prüft die Härtung des Containers.

## Ergebnis je Kategorie

| OWASP | Stand im Portal |
| --- | --- |
| A01 Fehlerhafte Zugriffskontrolle | Rechte zentral in `server/rechte.ts`, jede Route mit `wer`. Fremde Kennung → 404, falsche Rolle → 403; beides für jede Route im Test. Private Daten der Azubis haben keine Route für andere. |
| A02 Fehlkonfiguration | Strenge Content-Security-Policy (nur eigene Skripte und Stile), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS bei HTTPS, keine Quelltext-Karten im Betrieb. Container: App als Benutzer `node`, Port nur an 127.0.0.1, **neu** `no-new-privileges` und nur die nötigen Linux-Rechte. `DEV_ANMELDUNG` wirkt nicht mit `NODE_ENV=production`. |
| A03 Lieferkette | Nur vier Pakete im Betrieb (`openid-client`, `react`, `react-dom`, `tsx`). **Neu:** `npm audit` in der CI. Offen: keine `package-lock.json` im Repository (siehe unten). |
| A04 Kryptografie | Passwort mit scrypt (OWASP-Werte), Vergleich in konstanter Zeit; Sitzungs-Token mit 256 Bit Zufall, in der Datenbank nur als Hash. Cookie `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`. |
| A05 Injection | Datenbank nur mit Platzhaltern (`?`); eingesetzt werden nur feste Spaltenlisten. React maskiert jede Ausgabe. SVG aus Lerninhalten wird bereinigt, die CSP verhindert Skripte zusätzlich. **Neu:** Links in Lerninhalten nur mit `http(s)://` – `javascript:` wird abgelehnt. |
| A06 Unsicheres Design | Grenzen für Anfragen (256 KB, Uploads 8 bzw. 16 MB), für Anhänge (5 MB, 12 je Bericht) und für ZIP-Dateien (Pfade mit `..`, entpackte Größe). Dateityp der Anhänge am Dateianfang geprüft. Downloads als Anhang mit festem Typ. |
| A07 Anmeldung | Microsoft Entra mit PKCE, `state` und `nonce` (über `openid-client`), Mandant geprüft. Super-Admin: mindestens 14 Zeichen, nach fünf Fehlversuchen 15 Minuten Pause, Begrenzung je IP. Abmelden nach 8 Stunden ohne Anfrage, spätestens nach 24. Gegen fremde Seiten: Herkunft (`Origin`) bei jeder schreibenden Anfrage. Keine Weiterleitung an fremde Adressen. |
| A08 Integrität | Lerninhalte gehen erst nach Prüfung durch den Super-Admin ins Portal. Abgezeichnete Berichte sind gesperrt. |
| A09 Protokoll | Anmeldungen, Fehlversuche (mit IP) und Änderungen an Konten, Rechten und Einstellungen stehen im Protokoll. Geheimnisse (Webhook, SMTP, Kalender-Link) werden nie ausgegeben. |
| A10 Ausnahmen | Unerwartete Fehler → 500 mit „Interner Fehler“, Einzelheiten nur ins Server-Log. Ausfälle von Teams oder Mail halten nichts auf. |

## Offen

- **`package-lock.json` fehlt.** Ohne sie bekommt jeder Build die neueste passende Version jedes Pakets – auch eine, die gerade kompromittiert wurde. Empfehlung: einmal `npm install` auf einem Rechner mit Internet, die Datei einchecken, in Dockerfile und CI dann `npm ci`. (In der Entwicklungsumgebung hier ist die Paketquelle gesperrt.)
- **Dependabot** in den Einstellungen des Repositorys einschalten (Alerts und Security Updates). Das meldet Lücken, ohne dass jemand die CI anschauen muss.
- **Abgelehnte Zugriffe** (403/404 auf fremde Kennungen) werden nicht protokolliert. Häufen sie sich, wäre das ein Hinweis auf jemanden, der probiert. Bei Bedarf ergänzen – ohne Inhalte, nur Konto, Pfad und Zeit.

## Nicht geprüft

- Ein Penetrationstest durch Dritte und automatische Scanner (z. B. OWASP ZAP) gegen eine laufende Installation.
- Reverse Proxy, TLS und Netz beim Betreiber.
- Der Entra-Mandant (Zuweisung der Anwendung, bedingter Zugriff).
- Die Pakete selbst über `npm audit` hinaus.
