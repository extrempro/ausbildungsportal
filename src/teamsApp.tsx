import { useEffect, useState } from 'react';
import { api, ladeDatei } from './api';
import { melde } from './dialoge';
import { HandbuchLink } from './handbuchLink';

/**
 * Erscheinungsbild → Teams-App (nur Super-Admin): Stand, App-Paket zum Herunterladen und die Schritte bis zur ersten Meldung.
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
            <dd>{stand.aktiv ? 'Eingerichtet – Benachrichtigungen per Teams sind möglich.' : 'Noch nicht eingeschaltet – es gehen keine Nachrichten per Teams hinaus.'}</dd>
            <dt>App-ID</dt>
            <dd>
              <code>{stand.appId}</code>
              {!stand.ausEnv && <span className="leise klein"> (vorgeschlagen – noch nicht in der .env)</span>}
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
            <li>
              {stand.ausEnv ? (
                'Die App-ID steht schon in der .env (TEAMS_APP_ID).'
              ) : (
                <>
                  In der .env <code>TEAMS_APP_ID={stand.appId}</code> eintragen und das Portal neu starten. Erst dann gehen Nachrichten hinaus.
                </>
              )}
            </li>
            <li>Unter „Konto“ → „Benachrichtigungen“ eine Testnachricht per Teams an dich schicken.</li>
          </ol>
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <button type="button" className="knopf" disabled={laeuft} onClick={() => void herunterladen()}>
            {laeuft ? 'Erstellt …' : 'App-Paket herunterladen'}
          </button>
          <p className="leise klein">
            Ändern sich die Adresse des Portals oder der Name des Betriebs, bekommt das nächste Paket von selbst eine höhere Version. Im Teams Admin Center lädst du es dann als Aktualisierung hoch.
          </p>
        </>
      )}
    </section>
  );
}
