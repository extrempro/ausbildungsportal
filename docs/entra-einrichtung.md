# Anmeldung über Microsoft Entra ID einrichten

Stand: 13.11.2026 · passt zu Version 0.68.2

Diese Anleitung beschreibt, wie das Ausbildungsportal im eigenen Entra-Mandanten als Anwendung angelegt wird, damit sich Azubis, Ausbildungsbeauftragte und Ausbilder mit ihrem Microsoft-Konto anmelden können. Der Super-Admin meldet sich weiterhin lokal an und braucht nichts davon.

Konten werden in der App mit Entra-Anmeldename und Rolle angelegt; Rollen kommen nicht aus Entra. Die Adresse der App ist nur ein Konfigurationswert (`APP_URL`) und lässt sich in Entra jederzeit als weitere Umleitungs-URI nachtragen.

Die Bezeichnungen unten sind die des englischen Portals; im deutschen Portal heißen sie sinngemäß gleich. Microsoft ändert die Oberfläche gelegentlich – maßgeblich sind die verlinkten Microsoft-Seiten am Ende.

## Was am Ende vorliegen muss

| Wert | Woher | Kommt in `.env` als |
| --- | --- | --- |
| Verzeichnis-ID (Mandant) | App-Registrierung → Overview → „Directory (tenant) ID“ | `ENTRA_TENANT_ID` |
| Anwendungs-ID (Client) | App-Registrierung → Overview → „Application (client) ID“ | `ENTRA_CLIENT_ID` |
| Geheimer Clientschlüssel | Certificates & secrets → Spalte „Value“ | `ENTRA_CLIENT_SECRET` |
| Adresse der App | Reverse Proxy, z. B. `https://ausbildung.firma.de` | `APP_URL` (ohne Schrägstrich am Ende) |

## Voraussetzungen

- Ein Konto, das im Mandanten Anwendungen registrieren darf. Für Schritt 5 (Zugriff einschränken, Zustimmung erteilen) braucht es mindestens die Rolle **Cloud Application Administrator** oder die Besitzerrolle an der Unternehmensanwendung.
- Für den späteren Betrieb: eine feste HTTPS-Adresse der App. Zum Entwickeln und Testen genügt `http://localhost`.
- Der Server muss `login.microsoftonline.com` ausgehend über HTTPS erreichen. Die App selbst muss **nicht** aus dem Internet erreichbar sein – die Umleitung passiert im Browser der Nutzer.

## Schritt 1 – Anwendung registrieren

1. Im [Microsoft Entra admin center](https://entra.microsoft.com) anmelden. Bei mehreren Mandanten oben rechts den richtigen wählen.
2. **Entra ID → App registrations → New registration**.
3. **Name:** `Ausbildungsportal` (wird den Nutzern bei der Anmeldung angezeigt).
4. **Supported account types:** „Accounts in this organizational directory only“ (Single tenant). Nicht „Multitenant“ und keine persönlichen Microsoft-Konten.
5. **Redirect URI:** Plattform **Web** wählen und eintragen:
   - für den Betrieb: `https://<adresse-der-app>/api/auth/entra/callback`
   - solange die Adresse noch nicht feststeht: `http://localhost:3000/api/auth/entra/callback`
6. **Register**.

Auf der Seite **Overview** stehen danach „Application (client) ID“ und „Directory (tenant) ID“ – beide notieren.

## Schritt 2 – Umleitungs-URI prüfen bzw. nachtragen

Unter **Manage → Authentication**:

- Plattform muss **Web** sein (nicht „Single-page application“ – die App löst den Code auf dem Server ein).
- Weitere Adressen über **Add Redirect URI** ergänzen, z. B. später die echte Adresse zusätzlich zu `localhost`. Es dürfen mehrere eingetragen sein.
- Die Adresse muss **zeichengenau** zu `APP_URL` + `/api/auth/entra/callback` passen (Schema, Host, Port, Pfad). Die häufigste Fehlermeldung bei der Anmeldung, `AADSTS50011` (redirect URI mismatch), kommt von einer Abweichung hier.
- Außer `http://localhost` akzeptiert Entra nur `https://`.
- Die Kästchen unter „Implicit grant and hybrid flows“ (Access tokens, ID tokens) **nicht** ankreuzen.
- Optional „Front-channel logout URL“ leer lassen.

## Schritt 3 – Geheimen Clientschlüssel anlegen

1. **Manage → Certificates & secrets → Client secrets → New client secret**.
2. Beschreibung z. B. `ausbildungsportal-server`, Ablauf wählen (höchstens 24 Monate).
3. **Add** – und sofort den Wert aus der Spalte **Value** kopieren. Er wird nur dieses eine Mal angezeigt. Die „Secret ID“ daneben ist **nicht** der Schlüssel.
4. Ablaufdatum im Kalender vormerken. Ist der Schlüssel abgelaufen, kann sich außer dem Super-Admin niemand mehr anmelden, bis ein neuer eingetragen ist.

Der Schlüssel gehört nur in die `.env` auf dem Server – nie ins Git, nie in einen Chat oder ein Ticket.

## Schritt 4 – Berechtigungen

Unter **Manage → API permissions** steht standardmäßig „Microsoft Graph → User.Read (Delegated)“. Mehr ist nicht nötig: Die App fordert bei der Anmeldung nur `openid`, `profile` und `email` an und ruft Microsoft Graph nicht auf – außer, die Profilbilder sind eingeschaltet (nächster Abschnitt).

Keine Anwendungsberechtigungen (Application permissions) hinzufügen.

### Freiwillig: Profilbilder anzeigen

Das Portal kann die Profilbilder aus Microsoft 365 zeigen. Dafür liest es bei der Anmeldung das Bild der angemeldeten Person über Microsoft Graph (`/me/photos/96x96/$value`) – nur ihr eigenes, mit ihrem eigenen Zugriffstoken.

1. In der App-Registrierung unter **API-Berechtigungen** prüfen, ob **Microsoft Graph → User.Read** (delegiert) eingetragen ist. Bei neuen Registrierungen ist das meist schon so; sonst über „Berechtigung hinzufügen“ ergänzen.
2. **Administratorzustimmung erteilen** – sonst fragt Microsoft jede Person bei der nächsten Anmeldung nach ihrer Zustimmung, oder die Anmeldung scheitert, wenn Benutzer bei euch nicht selbst zustimmen dürfen.
3. Erst danach in der `.env` `ENTRA_PROFILBILD=true` setzen und `docker compose up -d`.

Gut zu wissen: Ohne den Schalter verlangt das Portal wie bisher nur `openid profile email`. Liefert Graph kein Bild oder antwortet nicht, gelingt die Anmeldung trotzdem. Jede Person kann ihr Bild unter „Konto“ abschalten; es wird dann gelöscht. Mit einem echten Mandanten ist diese Funktion noch nicht erprobt.

## Schritt 5 – Zugriff auf die Ausbildungsgruppe beschränken (empfohlen)

Ohne diesen Schritt kann jedes Konto des Mandanten die Microsoft-Anmeldung durchlaufen. Es käme zwar nicht in die App (dort fehlt das Konto), aber sauberer ist, es schon in Entra abzuweisen.

1. **Entra ID → Enterprise apps → All applications → Ausbildungsportal**.
2. **Manage → Properties → Assignment required?** auf **Yes**, dann **Save**.
3. **Manage → Users and groups → Add user/group**: die berechtigten Personen oder eine Gruppe (z. B. „Ausbildung“) auswählen, **Assign**.
4. **Security → Permissions → Grant admin consent for <Mandant>**. Das ist bei „Assignment required“ nötig, weil Nutzer dann nicht mehr selbst zustimmen können.

Hinweise:

- Die Zuweisung einer **Gruppe** setzt laut Microsoft eine Lizenz Entra ID P1 oder P2 voraus; einzelne Personen lassen sich ohne zuweisen. Bitte für den eigenen Mandanten prüfen.
- Wer hier nicht zugewiesen ist, bekommt bei der Anmeldung den Fehler `AADSTS50105`.
- Neue Azubis brauchen damit **zwei** Dinge: die Zuweisung in Entra (am einfachsten über die Gruppe) und das Konto in der App (legt der Ausbilder an).

## Schritt 6 – Werte in die App eintragen

In der `.env` neben der `docker-compose.yml` (Vorlage `.env.example`, die Datei steht in `.gitignore`):

```
APP_URL=https://ausbildung.firma.de
ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
ENTRA_CLIENT_ID=11111111-1111-1111-1111-111111111111
ENTRA_CLIENT_SECRET=<Wert aus Schritt 3>
```

Danach die App neu starten (`docker compose up -d` bzw. `npm start`). Fehlen die `ENTRA_*`-Werte, startet die App trotzdem; der Knopf „Mit Microsoft anmelden“ ist dann ausgeblendet und nur der Super-Admin kommt hinein.

## Schritt 7 – Erstes Konto anlegen und testen

1. Als Super-Admin lokal anmelden und unter **Verwaltung → Konten** den ersten Ausbilder anlegen: **Entra-Anmeldename** (der UPN, z. B. `vorname.nachname@firma.de` – so, wie er in Entra unter „User principal name“ steht), Anzeigename, Rolle „Ausbilder“.
2. Abmelden, **Mit Microsoft anmelden** wählen, mit diesem Konto anmelden.
3. Bei der ersten Anmeldung verknüpft die App das Konto fest mit der Objekt-ID aus Entra. Ändert sich später der Anmeldename (z. B. Namenswechsel), bleibt der Zugang erhalten.
4. Der Ausbilder legt danach Azubis und Ausbildungsbeauftragte selbst an.

## Hinter dem Reverse Proxy

- `APP_URL` ist die Adresse, die die Nutzer im Browser sehen – also die des Proxys, nicht `127.0.0.1:3000`.
- Die App leitet daraus die Umleitungs-URI ab und sendet Cookies nur über HTTPS, wenn `APP_URL` mit `https://` beginnt. Beim Start steht die erwartete Umleitungs-URI im Log.
- `TRUST_PROXY=true` setzen, damit die App die echte Client-IP aus `X-Forwarded-For` nimmt (für die Begrenzung der Anmeldeversuche und das Protokoll). Der Proxy muss diesen Header setzen bzw. ergänzen.
- Ändert sich die Adresse, in Entra die neue Umleitungs-URI eintragen (Schritt 2) und `APP_URL` anpassen. Client-ID und Schlüssel bleiben gleich.

## Fehlersuche

| Meldung | Ursache | Abhilfe |
| --- | --- | --- |
| `AADSTS50011` redirect URI mismatch | Umleitungs-URI in Entra passt nicht zu `APP_URL` | Schritt 2; auf `http`/`https`, Port und Schrägstriche achten |
| `AADSTS7000215` invalid client secret | statt „Value“ die „Secret ID“ kopiert, oder Schlüssel falsch übertragen | neuen Schlüssel anlegen (Schritt 3) |
| `AADSTS7000222` client secret expired | Schlüssel abgelaufen | neuen Schlüssel anlegen, `.env` anpassen, App neu starten |
| `AADSTS50105` not assigned | Person ist der Anwendung nicht zugewiesen | Schritt 5, Punkt 3 |
| `AADSTS65001` / Zustimmung erforderlich | Admin-Zustimmung fehlt | Schritt 5, Punkt 4 |
| `AADSTS700016` application not found | falsche Client-ID oder falscher Mandant | `ENTRA_CLIENT_ID` und `ENTRA_TENANT_ID` prüfen |
| App meldet „Kein Zugang – bitte an den Ausbilder wenden“ | Microsoft-Anmeldung war erfolgreich, aber in der App gibt es kein Konto mit diesem Anmeldenamen | Konto anlegen (Schritt 7) bzw. Schreibweise des UPN prüfen |
| Anmeldung springt immer wieder zur Anmeldeseite | Cookie wird nicht angenommen: `APP_URL` beginnt mit `https://`, die App wird aber über `http://` aufgerufen | über die HTTPS-Adresse aufrufen bzw. `APP_URL` berichtigen |
| „Die App ist für die Adresse … eingerichtet, aufgerufen wurde sie über …“ | `APP_URL` stimmt nicht mit der Adresse im Browser überein (z. B. eigener Port über `BIND_PORT` in der `.env`) | `APP_URL` auf die Adresse im Browser setzen, App neu starten |
| App meldet „Die Anmeldung über Microsoft ist fehlgeschlagen“ | Entra hat abgelehnt oder das Token war ungültig; der genaue Grund (z. B. `AADSTS…`) steht im Log der App | `docker compose logs app` bzw. die Ausgabe von `npm start` ansehen |

## Schlüssel erneuern (alle 24 Monate oder früher)

1. In Entra einen **zweiten** Schlüssel anlegen (Schritt 3) – der alte bleibt vorerst gültig.
2. `ENTRA_CLIENT_SECRET` in der `.env` ersetzen und die App neu starten.
3. Anmeldung testen, dann den alten Schlüssel in Entra löschen.

## Quellen (Microsoft Learn)

- [Redirect-URI zu einer Anwendung hinzufügen](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri)
- [Einschränkungen für Redirect-URIs](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
- [Anwendung auf bestimmte Nutzer beschränken („Assignment required“)](https://learn.microsoft.com/en-us/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users)
- [Schnellstart: Nutzer in einer Web-App anmelden](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-web-app-sign-in)
