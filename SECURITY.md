# Sicherheit

Das Ausbildungsportal speichert personenbezogene Daten von Beschäftigten. Bitte beim Betrieb beachten:

- **Nur über HTTPS betreiben** (Reverse Proxy mit Zertifikat). `APP_URL` muss die Adresse sein, die die Nutzer im Browser sehen.
- **Am besten nur im VPN erreichbar machen.** Die Anmeldung schützt die App, ein VPN zusätzlich vor allem, was die Anmeldung nicht abfängt.
- `data/` (Datenbank, Sicherungen) und `.env` (Client-Geheimnis) gehören **nie** ins Git oder in ein Container-Image. Sicherungen genauso schützen wie die Datenbank.
- In Entra die Unternehmensanwendung auf die Ausbildungsgruppe beschränken („Assignment required“), siehe [docs/entra-einrichtung.md](docs/entra-einrichtung.md).
- Das Client-Geheimnis läuft ab – rechtzeitig erneuern.
- `DEV_ANMELDUNG` nie auf einem erreichbaren Server einschalten (wird bei `NODE_ENV=production` ohnehin ignoriert).

## Was die App selbst tut

- Rechte werden nur im Server geprüft, an einer Stelle (`behandle` in `server/api.ts`) und über zentrale Funktionen (`server/rechte.ts`). Tests rufen jede Route mit jeder Rolle auf.
- Der Super-Admin sieht in der App keine Pläne und Berichte. **Das gilt nicht für den Serverbetreiber:** Wer Zugriff auf den Server hat, kann Datenbank und Sicherungen lesen.
- Die Microsoft-Anmeldung läuft über die Bibliothek `openid-client` (`server/entra.ts`): Sie prüft Signatur, Aussteller, Empfänger, Ablauf und Nonce des ID-Tokens. Die Signaturprüfung ist ausdrücklich eingeschaltet (`enableNonRepudiationChecks`), angenommen werden nur RS256-signierte Tokens des eigenen Mandanten.
- Webserver, Sitzungen, Passwort-Hash und Rechteprüfung sind selbst geschrieben und nutzen nur Node.js. Dafür gibt es Tests, aber keine unabhängige Prüfung.

## Sicherheitslücke melden

Bitte **kein öffentliches Issue** anlegen, sondern über GitHub privat melden: im Repository unter **Security → Report a vulnerability**. Beschreibe, was passiert und wie es sich nachstellen lässt.
