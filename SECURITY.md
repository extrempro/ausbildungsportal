# Sicherheit

Das Ausbildungsportal speichert personenbezogene Daten von Beschäftigten. Bitte beim Betrieb beachten:

- **Nur über HTTPS betreiben** (Reverse Proxy mit Zertifikat). `APP_URL` muss die Adresse sein, die die Nutzer im Browser sehen.
- **Am besten nur im VPN erreichbar machen.** Die Anmeldung schützt die App, ein VPN zusätzlich vor allem, was die Anmeldung nicht abfängt.
- `data/` (Datenbank, Sicherungen) und `.env` (Client-Geheimnis) gehören **nie** ins Git oder in ein Container-Image. Sicherungen genauso schützen wie die Datenbank.
- In Entra die Unternehmensanwendung auf die Ausbildungsgruppe beschränken („Assignment required“), siehe [docs/entra-einrichtung.md](docs/entra-einrichtung.md).
- Das Client-Geheimnis läuft ab – rechtzeitig erneuern.
- `DEV_ANMELDUNG` nie auf einem erreichbaren Server einschalten (wird bei `NODE_ENV=production` ohnehin ignoriert).

## Anmeldung des Super-Admins am Reverse Proxy schützen

Der Super-Admin ist das einzige Konto mit Passwort. Die App schützt es selbst: mindestens 14 Zeichen, nach fünf falschen Versuchen 15 Minuten Wartezeit, dazu eine Begrenzung je IP-Adresse; jeder Fehlversuch steht mit IP im Protokoll. Wer mehr will, lässt die Passwort-Anmeldung **nur aus dem eigenen Netz** zu. Das geht bei jedem Reverse Proxy nach demselben Muster.

### Was gesperrt werden muss

| Pfad | Bedeutung |
| --- | --- |
| `POST /api/auth/lokal` | **Darauf kommt es an.** Nur hier wird ein Passwort geprüft. Ist dieser Pfad von außen nicht erreichbar, kann sich von außen niemand als Super-Admin anmelden. |
| `/super` | Nur die Seite mit dem Anmeldeformular. Sie zu sperren ist ordentlich, schützt allein aber nichts – das Formular ist nicht der Zugang. |

Alles andere bleibt offen, sonst funktioniert die Microsoft-Anmeldung der übrigen Rollen nicht mehr. Insbesondere `/api/auth/entra/…` und `/api/konten` (das nutzen auch Ausbilder) nicht sperren.

### Wie

1. Am Proxy eine Regel anlegen, die genau diese beiden Pfade abfängt und vor der allgemeinen Weiterleitung greift.
2. Dort nur zulassen, wer aus dem Verwaltungsnetz kommt – also aus dem internen Netz oder dem VPN. Alle anderen bekommen `403` oder `404`.
3. Von außen prüfen (zum Beispiel über Mobilfunk): `https://<Adresse>/super` und ein `POST` auf `/api/auth/lokal` müssen abgewiesen werden, die normale Anmeldeseite muss weiter gehen.

Statt nach IP-Adresse lässt sich an derselben Stelle auch ein Client-Zertifikat (mTLS) oder eine vorgeschaltete Anmeldung des Proxys verlangen. Das Muster bleibt gleich: Die Hürde gilt nur für diese beiden Pfade.

### Beispiele

Die Netze sind Platzhalter – bitte durch die eigenen ersetzen. Die Beispiele zeigen das Muster und sind **nicht in jeder Proxy-Version getestet**; nach dem Einrichten immer Schritt 3 ausführen.

nginx:

```nginx
location = /super            { allow 10.0.0.0/8; allow 100.64.0.0/10; deny all; proxy_pass http://127.0.0.1:3000; }
location ^~ /api/auth/lokal  { allow 10.0.0.0/8; allow 100.64.0.0/10; deny all; proxy_pass http://127.0.0.1:3000; }
# die übrigen proxy_set_header-Zeilen wie im allgemeinen location-Block
```

Caddy:

```caddyfile
ausbildung.example.de {
    @superVonAussen {
        path /super /api/auth/lokal*
        not remote_ip 10.0.0.0/8 100.64.0.0/10
    }
    respond @superVonAussen 404
    reverse_proxy 127.0.0.1:3000
}
```

Traefik (Labels, Version 3; in Version 2 heißt die Middleware `ipWhiteList`):

```yaml
- traefik.http.routers.portal-super.rule=Host(`ausbildung.example.de`) && (Path(`/super`) || PathPrefix(`/api/auth/lokal`))
- traefik.http.routers.portal-super.priority=100
- traefik.http.routers.portal-super.middlewares=nur-intern
- traefik.http.middlewares.nur-intern.ipallowlist.sourcerange=10.0.0.0/8,100.64.0.0/10
```

### Worauf achten

- **Welche Adresse sieht der Proxy?** Steht davor noch etwas (zweiter Proxy, Load Balancer, CDN, NAT der Firewall), sieht der Proxy nur dessen Adresse. Dann würde die Regel alle durchlassen oder alle aussperren. In dem Fall die Regel am äußersten Proxy setzen oder die echte Client-Adresse sauber durchreichen und nur dem vorgeschalteten Gerät vertrauen.
- **Kein Weg am Proxy vorbei.** Die App darf nur für den Proxy erreichbar sein (Standard: `127.0.0.1:3000`). Ist der Port direkt offen, nützt die Regel nichts.
- **Die Sperre gilt für das Anmelden, nicht für die Sitzung.** Wer sich im Verwaltungsnetz angemeldet hat, bleibt mit demselben Browser auch außerhalb angemeldet, bis die Sitzung endet. Nach der Arbeit abmelden.
- **Notfall:** Sperrt man sich aus, bleibt der Weg über den Server selbst (`npm run admin-reset` setzt ein neues Startpasswort; anmelden dann aus dem Verwaltungsnetz).
- Das ersetzt nichts von oben: starkes Passwort, HTTPS, und am besten die ganze App nur im VPN.

## Kalender-Abo

Der Kalender-Link (`/api/abo/<Geheimnis>.ics`) ist der einzige Weg, ohne Anmeldung Daten zu lesen. Er enthält ein zufälliges Geheimnis mit 256 Bit, gibt nur Lesezugriff auf Schulblöcke, Einsätze, Prüfungstermine und genehmigten Urlaub (im eigenen Abo eines Azubis auch auf seine privaten Termine) und prüft bei jedem Abruf die Rechte des Kontos.

- **Das Geheimnis steht in der Adresse – und damit in den Zugriffs-Logs des Reverse Proxys.** Die Logs genauso schützen wie die Datenbank, oder den Pfad `/api/abo/` vom Logging ausnehmen bzw. kürzen.
- Wer den Link in Outlook (neu/Web) oder Google Kalender einträgt, gibt ihn und die Termine an Microsoft bzw. Google weiter; deren Server rufen ihn ab.
- Ein Link, der in falsche Hände geraten ist, wird unter „Konto“ erneuert. Sperrt man das Konto, liefert der Link sofort nichts mehr.
- Das Geheimnis liegt im Klartext in der Datenbank, damit das Portal den Link erneut anzeigen kann. Wer die Datenbank lesen kann, sieht die Pläne ohnehin.

## Lernmodul

- Die Lerninhalte sind Dateien: Der Betreiber bindet sie als Ordner ein (`LERN_DIR`), oder ein Ausbilder reicht sie als ZIP-Datei ein und der Super-Admin lädt sie nach Prüfung hoch. Das Portal prüft ein eingereichtes Archiv (Größe, Zahl und Art der Dateien, keine Pfade nach außen) und übernimmt nur Dateien, die zu einem Inhaltspaket gehören. Es behandelt die Inhalte als vertrauenswürdig, bereinigt die Grafiken aber trotzdem: `<script>`, `<foreignObject>`, Ereignis-Attribute, `javascript:` und Verweise nach außen werden aus den SVGs entfernt, bevor sie in die Seite eingebettet werden. Texte werden nie als HTML ausgegeben. Nur Inhalte aus Quellen einbinden, denen man vertraut.
- Lernstand (Ampel, Lernpunkt, Notiz), Abzeichen, Übungsergebnisse, die Eintragungen im Planer für die Prüfung und der Begleiter sind privat: Es gibt ausschließlich Routen für den Azubi selbst. Wer den Server betreibt, kann ihn wie alles in der Datenbank lesen.

## Was die App selbst tut

- Rechte werden nur im Server geprüft, an einer Stelle (`behandle` in `server/api.ts`) und über zentrale Funktionen (`server/rechte.ts`). Tests rufen jede Route mit jeder Rolle auf.
- Der Super-Admin sieht in der App keine Pläne und Berichte. **Das gilt nicht für den Serverbetreiber:** Wer Zugriff auf den Server hat, kann Datenbank und Sicherungen lesen.
- Die Microsoft-Anmeldung läuft über die Bibliothek `openid-client` (`server/entra.ts`): Sie prüft Signatur, Aussteller, Empfänger, Ablauf und Nonce des ID-Tokens. Die Signaturprüfung ist ausdrücklich eingeschaltet (`enableNonRepudiationChecks`), angenommen werden nur RS256-signierte Tokens des eigenen Mandanten.
- Webserver, Sitzungen, Passwort-Hash und Rechteprüfung sind selbst geschrieben und nutzen nur Node.js. Dafür gibt es Tests, aber keine unabhängige Prüfung.

## Sicherheitslücke melden

Bitte **kein öffentliches Issue** anlegen, sondern über GitHub privat melden: im Repository unter **Security → Report a vulnerability**. Beschreibe, was passiert und wie es sich nachstellen lässt.
