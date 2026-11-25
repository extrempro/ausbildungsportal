import { useEffect, useState } from 'react';
import { api, ladeDatei } from './api';
import { melde, rueckfrage } from './dialoge';
import { HandbuchLink } from './handbuchLink';

/**
 * Erscheinungsbild → Teams-App (nur Super-Admin): Stand, App-Paket zum Herunterladen, App-ID, Einschalten und die Schritte bis zur ersten Meldung.
 * Ein- und ausgeschaltet wird hier (in der Datenbank); steht TEAMS_APP_ID in der .env, gilt die – dann ist hier nichts zu ändern.
 * Was in Entra und im Teams Admin Center zu tun ist, steht ausführlich in docs/entra-einrichtung.md.
 */
interface Stand {
  entra: boolean;
  appId: string | null;
  ausEnv: boolean;
  aktiv: boolean;
  version: string | null;
  clientId: string | null;
  ressource: string | null;
  sso: boolean;
}

export function TeamsApp() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [ladefehler, setLadefehler] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const lade = () =>
    api<Stand>('GET', '/api/teams').then(
      (s) => {
        setStand(s);
        setLadefehler('');
      },
      (e: unknown) => setLadefehler(e instanceof Error ? e.message : 'Fehler'),
    );
  useEffect(() => void lade(), []);

  const [neueId, setNeueId] = useState('');
  const setze = async (body: { aktiv?: boolean; appId?: string }, fertig: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      setStand(await api<Stand>('PUT', '/api/teams', body));
      setNeueId('');
      melde(fertig);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };
  const schalteAus = async () => {
    if (await rueckfrage('Teams-App ausschalten?\n\nDanach gehen keine Nachrichten per Teams mehr hinaus, und das Portal lässt sich in Teams nicht mehr öffnen. Die App in Teams bleibt installiert.', { ja: 'Teams-App ausschalten', gefahr: true }))
      await setze({ aktiv: false }, 'Teams-App ausgeschaltet.');
  };
  const aendereId = async () => {
    if (await rueckfrage(`App-ID auf ${neueId.trim()} ändern?\n\nSie muss zur App passen, die im Teams Admin Center hochgeladen ist – sonst kommen keine Nachrichten an.`, { ja: 'App-ID ändern' }))
      await setze({ appId: neueId }, 'App-ID geändert.');
  };

  const herunterladen = async () => {
    setLaeuft(true);
    setFehler('');
    try {
      await ladeDatei('/api/teams/paket');
      await lade();
      melde('App-Paket heruntergeladen.');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className="karte" id="teams-app">
      <h2>Teams-App</h2>
      <p className="leise">
        Mit der App „Ausbildungsportal“ läuft das Portal direkt in Teams, und Benachrichtigungen erscheinen in Teams unter „Aktivität“. Welche Nachrichten jemand bekommt, stellt jede Person unter „Konto“ selbst ein.{' '}
        <HandbuchLink kapitel="teams-app">Teams-App einrichten</HandbuchLink>
      </p>
      {ladefehler && (
        <p className="hinweis fehler" role="alert">
          {ladefehler}
        </p>
      )}
      {stand && !stand.entra && (
        <p className="hinweis" role="status">
          Die Teams-App braucht die Anmeldung mit Microsoft. Solange sie nicht eingerichtet ist (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET in der .env), lässt sich kein Paket erstellen.
        </p>
      )}
      {stand?.entra && (
        <>
          <dl className="meldung-angaben">
            <dt>Stand</dt>
            <dd>{stand.aktiv ? 'Eingeschaltet – Benachrichtigungen per Teams sind möglich.' : 'Ausgeschaltet – es gehen keine Nachrichten per Teams hinaus.'}</dd>
            <dt>App-ID</dt>
            <dd>
              <code>{stand.appId}</code>
              {stand.ausEnv && <span className="leise klein"> (aus der .env, TEAMS_APP_ID)</span>}
            </dd>
            <dt>Version des Pakets</dt>
            <dd>{stand.version ?? 'noch keins heruntergeladen'}</dd>
            <dt>Portal in Teams</dt>
            <dd>{stand.sso ? 'Möglich – in der App meldet man sich mit dem Microsoft-Konto an.' : 'Nicht möglich – diesem Portal fehlt die Bibliothek für Teams. Die App zeigt dann nur „Im Browser öffnen“.'}</dd>
          </dl>
          <ol className="schritte">
            <li>In Entra bei der App-Registrierung des Portals die Anwendungsberechtigung „TeamsActivity.Send“ (Microsoft Graph) hinzufügen und die Administratorzustimmung erteilen.</li>
            <li>
              Ebenfalls in Entra unter „API verfügbar machen“: Anwendungs-ID-URI <code>{stand.ressource}</code>, Bereich „access_as_user“ und Teams als berechtigte Clientanwendung. Damit meldet die App
              ohne erneute Eingabe an. Die Einzelheiten stehen in der Anleitung zur Einrichtung von Entra.
            </li>
            <li>Das App-Paket herunterladen und im Teams Admin Center unter „Apps verwalten“ hochladen. Per Setup-Richtlinie für alle installieren, die das Portal nutzen – ohne installierte App kommt nichts an.</li>
            <li>Hier unten „Teams-App einschalten“. Erst dann gehen Nachrichten hinaus und meldet die App in Teams an.</li>
            <li>Unter „Konto“ → „Benachrichtigungen“ eine Testnachricht per Teams an dich schicken.</li>
          </ol>
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <p className="aktionen links">
            <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void herunterladen()}>
              App-Paket herunterladen
            </button>
            {stand.aktiv ? (
              <button type="button" className="knopf schlicht gefahr" disabled={laeuft || stand.ausEnv} onClick={() => void schalteAus()}>
                Teams-App ausschalten
              </button>
            ) : (
              <button type="button" className="knopf" disabled={laeuft || stand.ausEnv} onClick={() => void setze({ aktiv: true }, 'Teams-App eingeschaltet.')}>
                Teams-App einschalten
              </button>
            )}
          </p>
          {stand.ausEnv && (
            <p className="hinweis" role="note">
              Die Teams-App ist über <code>TEAMS_APP_ID</code> in der .env eingerichtet und deshalb immer eingeschaltet. Wer sie hier verwalten will, entfernt den Eintrag aus der .env und startet das Portal
              neu – die App-ID bleibt erhalten.
            </p>
          )}
          {!stand.ausEnv && (
            <details className="klapp">
              <summary>App-ID ändern</summary>
              <p className="leise klein">
                Nur nötig, wenn in Teams schon eine App „Ausbildungsportal“ mit einer anderen ID hochgeladen ist – etwa nach dem Neuaufsetzen des Portals. Die ID steht im Teams Admin Center bei der App.
              </p>
              <div className="reihe">
                <label>
                  Neue App-ID
                  <input value={neueId} onChange={(e) => setNeueId(e.target.value)} placeholder="12345678-abcd-4ef0-9876-0123456789ab" spellCheck={false} autoComplete="off" />
                </label>
              </div>
              <p className="aktionen links">
                <button type="button" className="knopf schlicht" disabled={laeuft || neueId.trim() === ''} onClick={() => void aendereId()}>
                  App-ID ändern
                </button>
              </p>
            </details>
          )}
          <p className="leise klein">
            Ändern sich die Adresse des Portals oder der Name des Betriebs, bekommt das nächste Paket von selbst eine höhere Version. Im Teams Admin Center lädst du es dann als Aktualisierung hoch.
          </p>
        </>
      )}
    </section>
  );
}
