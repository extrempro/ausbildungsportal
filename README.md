# Ausbildungsportal

Ausbildungsplan und Berichtsheft für einen Ausbildungsbetrieb – mit Anmeldung und Rollen. Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto (Entra ID) an; ein lokaler Super-Admin verwaltet die Konten.

**Stand: Version 0.4.0 (Phase 2 – Stammdaten).** Anmeldung, Konten, Rechte, Protokoll, Stammdaten und Azubi-Profile sind fertig, dazu das Docker-Setup. Berichtsheft und Ausbildungsplan folgen in den nächsten Phasen.

> **Frühe Version – noch nicht für den Echtbetrieb.** Die Anmeldung über Microsoft ist bisher nur gegen einen nachgebildeten Anbieter getestet, nicht gegen ein echtes Entra-Verzeichnis. Eine unabhängige Sicherheitsprüfung gab es nicht. Wer die App einsetzt, tut das auf eigene Verantwortung (siehe [LICENSE](LICENSE)).

## Rollen

| Rolle | Anmeldung | Darf |
| --- | --- | --- |
| Super-Admin | lokal mit Passwort | ausschließlich Konten anlegen, sperren und löschen – kein Zugriff auf Pläne und Berichte |
| Ausbilder | Microsoft | alle Azubis sehen, Stammdaten und Azubi-Profile pflegen, Konten für Azubis und Beauftragte anlegen, sperren und löschen, Beauftragte zuweisen |
| Ausbildungsbeauftragte | Microsoft | nur zugewiesene Azubis sehen, im Zeitraum der Zuweisung abzeichnen |
| Azubi | Microsoft | nur die eigenen Daten |

Rechte werden ausschließlich im Server geprüft (`server/rechte.ts`, `server/api.ts`); die Oberfläche blendet nur aus.

## Starten mit Docker

Voraussetzung: Docker mit Docker Compose ab Version 2.24.

```bash
cp .env.example .env      # APP_URL und die ENTRA_*-Werte eintragen
docker compose up -d --build
docker compose logs app   # beim ersten Start steht hier das Startpasswort des Super-Admins
```

- Die App lauscht danach auf `127.0.0.1:3000` – nur auf dem Server selbst. Davor gehört ein **Reverse Proxy mit HTTPS**; `APP_URL` in der `.env` ist die Adresse dieses Proxys, und `TRUST_PROXY=true` gehört dazu.
- Einen anderen Port oder eine Freigabe im Netz stellt man in einer eigenen `docker-compose.override.yml` ein (Vorlage: `docker-compose.override.example.yml`), nicht in `docker-compose.yml`. Übernommen wird sie mit `docker compose up -d` (nicht mit `restart`). Kontrolle: `docker compose config` zeigt, was gilt, `docker compose ps` den tatsächlich offenen Port – im Log der App steht immer Port 3000, das ist der Port im Container.
- **`APP_URL` muss immer die Adresse sein, die im Browser steht.** Wer in der Override-Datei Port oder IP ändert und die App direkt aufruft, trägt genau diese Adresse ein, z. B. `APP_URL=http://100.64.0.10:8989`. Sonst lädt die Seite, aber Anmelden und Speichern werden abgelehnt.
- Ohne HTTPS funktioniert nur die lokale Anmeldung des Super-Admins. Microsoft nimmt als Umleitungs-URI nur `https://` an (Ausnahme `http://localhost`) – für die Microsoft-Anmeldung braucht es also den Reverse Proxy mit Zertifikat.
- Datenbank und Sicherungen liegen im Ordner `./data` neben der Compose-Datei und bleiben bei Updates und bei `docker compose down` erhalten.
- Die App läuft im Container als Benutzer mit der UID 1000, nicht als root. Die Rechte am Ordner `./data` richtet der Container beim Start selbst; nur wenn das nicht geht (z. B. Netzlaufwerk), von Hand: `sudo chown -R 1000:1000 ./data`.
- Nach einer Änderung an der `.env`: `docker compose up -d`. Update: `git pull`, dann `docker compose up -d --build`.

Zum Ausprobieren ohne Proxy und ohne `.env` reicht `docker compose up -d --build` und im Browser `http://localhost:3000` (nicht `127.0.0.1` – die Adresse muss zu `APP_URL` passen). Dann kann sich nur der Super-Admin anmelden.

## Starten ohne Docker

Voraussetzungen:

- Node.js ab 22.16 (nutzt das eingebaute `node:sqlite`)
- für die Microsoft-Anmeldung: eine App-Registrierung in Entra, siehe [docs/entra-einrichtung.md](docs/entra-einrichtung.md)

```bash
npm install
cp .env.example .env      # APP_URL und später die ENTRA_*-Werte eintragen
npm run build             # Oberfläche nach dist/ bauen
npm start                 # Server auf Port 3000
```

Beim **ersten Start** legt die App den Super-Admin an. Ohne `ADMIN_BENUTZER`/`ADMIN_PASSWORT` heißt er `admin`, und das Startpasswort steht einmalig in der Ausgabe. Bei der ersten Anmeldung muss es geändert werden (mindestens 14 Zeichen).

Danach als Super-Admin den ersten Ausbilder anlegen (Microsoft-Anmeldename + Rolle). Der Ausbilder legt Azubis und Beauftragte selbst an.

### Entwickeln

```bash
npm run dev               # baut die Oberfläche bei Änderungen neu und startet den Server neu
npm test                  # Tests (node:test)
npm run typecheck
```

Mit `DEV_ANMELDUNG=true` in der `.env` kann man sich lokal ohne Entra als vorhandenes Konto anmelden. Die Einstellung wird in Produktion ignoriert.

## Konfiguration

Alle Einstellungen kommen aus Umgebungsvariablen (`.env`, Vorlage `.env.example`):

| Variable | Bedeutung |
| --- | --- |
| `APP_URL` | Adresse, unter der die Nutzer die App im Browser sehen. Bestimmt die Umleitungs-URI für Entra (`<APP_URL>/api/auth/entra/callback`) und ob Cookies nur über HTTPS gehen |
| `PORT`, `HOST` | worauf der Server lauscht (Standard `3000`, `0.0.0.0`); mit Docker fest, den Port außen bestimmt die Compose-Datei |
| `DATA_DIR` | Ordner für Datenbank und Sicherungen (Standard `./data`); mit Docker fest `/app/data` |
| `CONTENT_DIR` | Ordner mit gepflegten Inhalten wie den Schulferien (Standard `./content`); mit Docker fest `/app/content` |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | App-Registrierung in Entra; ohne sie kann sich nur der Super-Admin anmelden |
| `ADMIN_BENUTZER`, `ADMIN_PASSWORT` | nur für den ersten Start |
| `TRUST_PROXY` | `true` hinter einem Reverse Proxy (Client-IP aus `X-Forwarded-For`) |
| `DEV_ANMELDUNG` | nur zum Entwickeln |

## Berufe, Feiertage und Ferien

Die App ist nicht auf einen Beruf oder ein Bundesland festgelegt:

- **Berufe** legen die Ausbilder unter „Stammdaten“ an, jeweils mit Regeldauer in Monaten (meist 24, 36 oder 42). Aus Ausbildungsbeginn, Regeldauer und Verkürzung berechnet die App Ausbildungsjahr und Ende. Sie rechnet nur – ob eine Verkürzung zulässig ist, entscheidet die zuständige Kammer.
- **Feiertage** richten sich nach dem Bundesland des Betriebs und werden für alle 16 Länder berechnet. Feiertage, die nur in Teilen eines Landes gelten (z. B. Mariä Himmelfahrt in Bayern, Fronleichnam in Teilen von Sachsen und Thüringen), sind als „teilweise“ gekennzeichnet.
- **Schulferien** richten sich nach dem Bundesland der Berufsschule und kommen aus Dateien in `content/ferien/`. Mitgeliefert ist bisher nur Hamburg; wie man weitere Länder ergänzt, steht in [content/README.md](content/README.md).

## Sicherheit in Kürze

- Microsoft-Anmeldung: OpenID Connect, Authorization Code Flow mit PKCE über die Bibliothek [openid-client](https://github.com/panva/openid-client); geprüft werden Signatur, Aussteller, Empfänger, Ablauf, Nonce und Mandant. Konten hängen an der Objekt-ID aus Entra, nicht am Namen. Wer kein Konto in der App hat, kommt nicht hinein.
- Lokales Passwort: scrypt, 5 Fehlversuche → 15 Minuten Wartezeit, Begrenzung je IP.
- Sitzungen liegen im Server (SQLite, nur als Hash); Cookie `HttpOnly`, `SameSite=Lax`, über HTTPS zusätzlich `Secure` und `__Host-`. Ende nach 8 Stunden ohne Aktivität, spätestens nach 24 Stunden. Sperren wirkt sofort.
- Schreibende Anfragen nur von der eigenen Adresse (`Origin`-Prüfung), strenge Content-Security-Policy.
- Protokoll über Anmeldungen und Kontenänderungen, ohne Passwörter und ohne Inhalte.

Der Server nutzt außer Node.js selbst nur **eine** Bibliothek: `openid-client` für die Microsoft-Anmeldung. Mehr dazu und der Meldeweg für Lücken: [SECURITY.md](SECURITY.md).

Für den Betrieb gilt: nur über HTTPS (Reverse Proxy) und am besten nur im VPN. `data/` und `.env` gehören nie ins Git.

## Betrieb

```bash
npm run backup                    # Sicherung nach data/backups/ (auch im laufenden Betrieb)
npm run admin-reset [benutzer]    # Notfall: neues Startpasswort für einen Super-Admin
```

Mit Docker dieselben Befehle im Container: `docker compose exec app npm run backup` bzw. `docker compose exec app npm run admin-reset`.

Datenbank-Änderungen kommen als nummerierte Migrationen (`server/migrations/`); vor jeder Migration legt die App automatisch eine Sicherung an.

## Aufbau

```
server/
  index.ts        Start
  http.ts         Webserver: /api und das gebaute Frontend
  api.ts          alle Routen mit ihren Rechten, ein einziger Einstieg (behandle)
  rechte.ts       zentrale Rechteprüfung
  stammdaten.ts   Betrieb, Berufe, Berufsschulen, Azubi-Profil, Kalender
  kalender.ts     Ausbildungsdauer; feiertage.ts, ferien.ts
  entra.ts        Anmeldung über Microsoft Entra ID (openid-client)
  passwort.ts     scrypt, Passwortregeln
  sitzung.ts      Sitzungen
  protokoll.ts    Protokoll
  migrations/     Datenbank-Schema
  test/           Tests, u. a. jede Route × jede Rolle
src/              Oberfläche (React)
scripts/          build, dev, backup, admin-reset
content/          gepflegte Inhalte: Schulferien je Bundesland
docs/             Entra-Einrichtung
Dockerfile, docker-compose.yml, docker-compose.override.example.yml
```

## Lizenz

MIT, siehe [LICENSE](LICENSE). Grundgerüst und Design-Tokens stammen aus dem [FISI-Lernkompass](https://github.com/extrempro/fisi-lernkompass).
