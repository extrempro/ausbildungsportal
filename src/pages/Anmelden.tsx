import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, logoFuer } from '../api';
import type { Logos } from '../api';

const FEHLER: Record<string, string> = {
  kein_zugang: 'Kein Zugang: Für dieses Microsoft-Konto gibt es im Ausbildungsportal kein Konto. Bitte an den Ausbilder wenden.',
  gesperrt: 'Dieses Konto ist gesperrt. Bitte an den Ausbilder wenden.',
  abgelaufen: 'Die Anmeldung ist abgelaufen oder wurde in einem anderen Fenster begonnen. Bitte noch einmal versuchen.',
  abgebrochen: 'Die Anmeldung bei Microsoft wurde abgebrochen.',
  entra_fehler: 'Die Anmeldung über Microsoft ist fehlgeschlagen. Bitte später erneut versuchen oder den Administrator informieren.',
  entra_aus: 'Die Anmeldung über Microsoft ist noch nicht eingerichtet.',
};

/** Anmeldeseite. Unter /super steht statt der Microsoft-Anmeldung die lokale Anmeldung des Super-Admins. */
export function Anmelden({ superAdmin = false }: { superAdmin?: boolean }) {
  const [status, setStatus] = useState<{ entra: boolean; dev: boolean } | null>(null);
  const [fehler, setFehler] = useState(() => FEHLER[new URLSearchParams(window.location.search).get('fehler') ?? ''] ?? '');
  const [laeuft, setLaeuft] = useState(false);
  const [logos, setLogos] = useState<Logos>({ logo: null, logoDunkel: null });
  // die Darstellung steht schon fest, bevor jemand angemeldet ist (letzter Besuch oder Einstellung des Geräts)
  const logo = logoFuer(logos, document.documentElement.classList.contains('dark'));

  useEffect(() => {
    api<{ entra: boolean; dev: boolean }>('GET', '/api/auth/status').then(setStatus, () => setStatus({ entra: false, dev: false }));
    api<Logos>('GET', '/api/branding').then(setLogos, () => {});
  }, []);

  const sende = (pfad: string, daten: (f: FormData) => unknown) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', pfad, daten(new FormData(e.currentTarget)));
      window.location.assign('/');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
      setLaeuft(false);
    }
  };

  return (
    <main className="schmal">
      <img src={logo ?? '/favicon.svg'} alt={logo ? 'Logo des Betriebs' : ''} className={logo ? 'anmelde-logo' : 'anmelde-logo symbol'} />
      <h1>Ausbildungsportal</h1>
      <p className="leise">{superAdmin ? 'Verwaltung' : 'Ausbildungsplan und Berichtsheft'}</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {superAdmin ? (
        <div className="karte">
          <h2>Anmeldung für den Super-Admin</h2>
          <form onSubmit={sende('/api/auth/lokal', (f) => ({ benutzername: f.get('benutzername'), passwort: f.get('passwort') }))}>
            <label>
              Benutzername
              <input name="benutzername" autoComplete="username" autoCapitalize="none" required />
            </label>
            <label>
              Passwort
              <input name="passwort" type="password" autoComplete="current-password" required />
            </label>
            <button className="knopf" disabled={laeuft}>
              Anmelden
            </button>
          </form>
          <p className="leise klein abstand">
            Azubis, Ausbildungsbeauftragte und Ausbilder melden sich <a href="/">auf der Startseite mit Microsoft</a> an.
          </p>
        </div>
      ) : (
        <div className="karte">
          {status?.entra ? (
            <a className="knopf gross" href="/api/auth/entra/login">
              Mit Microsoft anmelden
            </a>
          ) : (
            <p className="leise">
              {status ? (
                <>
                  Die Anmeldung über Microsoft ist noch nicht eingerichtet. Der Super-Admin meldet sich unter <a href="/super">/super</a> an.
                </>
              ) : (
                'Lädt …'
              )}
            </p>
          )}
        </div>
      )}


      {status?.dev && (
        <details className="karte">
          <summary>Entwicklung: als Testkonto anmelden</summary>
          <form onSubmit={sende('/api/auth/dev', (f) => ({ anmeldename: f.get('anmeldename') }))}>
            <label>
              Entra-Anmeldename eines vorhandenen Kontos
              <input name="anmeldename" type="email" required />
            </label>
            <button className="knopf" disabled={laeuft}>
              Ohne Microsoft anmelden
            </button>
          </form>
        </details>
      )}
    </main>
  );
}
