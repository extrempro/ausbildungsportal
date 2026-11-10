# Änderungen

## [0.4.0] – 2026-11-10

### Neu

- Stammdaten (Phase 2): Ausbilder pflegen den Betrieb, beliebige Ausbildungsberufe mit Regeldauer und Berufsschulen mit Bundesland.
- Azubi-Profil: Beruf, Berufsschule, zuständiger Ausbilder, Ausbildungsbeginn, Vertragsende, Verkürzung, vorzeitige Zulassung und Wochenstunden. Daraus berechnet die App Ausbildungsjahr und Ende der Ausbildung.
- Neue Seiten „Azubis“ (Liste und Einzelansicht) und „Stammdaten“; Ausbildungsbeauftragte lassen sich in der Einzelansicht mit Zeitraum zuweisen. Azubis sehen ihre Ausbildung auf der Startseite.
- Kalender: gesetzliche Feiertage aller 16 Bundesländer (berechnet) und Schulferien aus `content/ferien/<Kürzel>.json`. Mitgeliefert sind die Ferien für Hamburg.
- Favicon für den Browser-Tab.

## [0.3.1] – 2026-11-10

### Behoben

- Docker: Der Container startete nicht, wenn Docker den Ordner `./data` selbst angelegt hatte („In den Datenordner /app/data kann nicht geschrieben werden“). Er richtet die Rechte jetzt beim Start selbst und wechselt danach zum Benutzer `node`; `sudo chown` von Hand ist nicht mehr nötig. Auch `docker compose exec app npm run backup` und `admin-reset` schreiben als dieser Benutzer.

### Geändert

- Passt `APP_URL` nicht zur Adresse im Browser (z. B. eigener Port oder eigene IP in `docker-compose.override.yml`), nennt die Fehlermeldung jetzt beide Adressen und was einzutragen ist; derselbe Hinweis steht im Log.
- `docker-compose.override.example.yml` und README erklären die Bindung an eine VPN-Adresse und dass `APP_URL` dazu passen muss.
- Die Startmeldung im Log sagt jetzt ausdrücklich, dass der genannte Port mit Docker der Port im Container ist; den Port außen zeigt `docker compose ps`.

## [0.3.0] – 2026-11-10

### Neu

- Docker-Setup: `Dockerfile`, `docker-compose.yml` und Vorlage `docker-compose.override.example.yml` für eigene Ports. Start mit `docker compose up -d --build`; die Daten liegen im Ordner `./data`.

## [0.2.0] – 2026-11-10

### Neu

- Erste veröffentlichte Version (Phase 1 – Fundament): Anmeldung, Konten, Rechte und Protokoll.
- Anmeldung über Microsoft Entra ID für Azubis, Ausbildungsbeauftragte und Ausbilder (OpenID Connect mit PKCE über die Bibliothek `openid-client`, Signaturprüfung des ID-Tokens eingeschaltet); lokale Anmeldung für den Super-Admin mit erzwungenem Passwortwechsel beim ersten Mal.
- Kontenverwaltung: Der Super-Admin legt alle Konten an, sperrt und löscht sie. Ausbilder legen Azubis und Ausbildungsbeauftragte an, sperren und löschen sie und lösen die Verknüpfung mit dem Microsoft-Konto. Konten von Ausbildern und Super-Admins ändert und löscht nur der Super-Admin.
- Zentrale Rechteprüfung im Server, Zuweisung von Azubis an Beauftragte mit optionalem Zeitraum.
- Protokoll über Anmeldungen und Kontenänderungen; der Super-Admin sieht nur Konto-Ereignisse.
- Sicherung (`npm run backup`) und Notfall-Zurücksetzen des Super-Admin-Passworts (`npm run admin-reset`).
