import { useEffect, useState } from 'react';
import { api, zeit } from './api';
import type { Konto } from './api';
import { melde, rueckfrage } from './dialoge';

interface Abo {
  aktiv: boolean;
  url?: string;
  erstellt?: string;
  letzterAbruf?: string | null;
  azubis?: { id: number; anzeigename: string }[];
}

/** Kalender-Abo auf der Kontoseite: persönlichen Link erstellen, kopieren, erneuern, abschalten. */
export function KalenderAbo({ konto }: { konto: Konto }) {
  const [abo, setAbo] = useState<Abo | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [nur, setNur] = useState('');

  useEffect(() => {
    api<Abo>('GET', '/api/ich/kalender').then(setAbo, (e: Error) => setFehler(e.message));
  }, []);

  const tue = async (methode: 'POST' | 'DELETE', bestaetigung: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      setAbo(await api<Abo>(methode, '/api/ich/kalender'));
      melde(bestaetigung);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };

  const betreut = konto.rolle !== 'azubi';
  const url = abo?.url ? abo.url + (nur ? `?azubi=${nur}` : '') : '';

  const kopiere = async () => {
    try {
      await navigator.clipboard.writeText(url);
      melde('Link kopiert.');
    } catch {
      setFehler('Kopieren hat nicht geklappt. Bitte den Link im Feld markieren und von Hand kopieren.');
    }
  };

  return (
    <>
      <p>
        {betreut
          ? 'Zeigt Berufsschule, Einsätze und Prüfungstermine deiner Azubis in deinem Kalender – zum Beispiel in Outlook oder auf dem Handy.'
          : 'Zeigt Berufsschule, Einsätze, Prüfungstermine und deine eigenen Termine aus dem Ausbildungsplan in deinem Kalender – zum Beispiel auf dem Handy oder in Outlook.'}{' '}
        Dafür bekommst du einen persönlichen Link, den du einmal im Kalenderprogramm einträgst.
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {abo === null && !fehler && <p className="leise">Lädt …</p>}

      {abo && !abo.aktiv && (
        <div className="aktionen links">
          <button type="button" className="knopf" disabled={laeuft} onClick={() => void tue('POST', 'Kalender-Link erstellt.')}>
            Kalender-Link erstellen
          </button>
        </div>
      )}

      {abo?.aktiv && (
        <>
          {betreut && (abo.azubis?.length ?? 0) > 1 && (
            <label>
              Welche Azubis
              <select value={nur} onChange={(e) => setNur(e.target.value)}>
                <option value="">Alle meine Azubis (mit Namen im Termin)</option>
                {abo.azubis!.map((a) => (
                  <option key={a.id} value={a.id}>
                    Nur {a.anzeigename}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Dein Kalender-Link
            <input className="abo-link" readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="aktionen links">
            <button type="button" className="knopf" onClick={() => void kopiere()}>
              Link kopieren
            </button>
            <a className="knopf schlicht" href={url.replace(/^https?:/, 'webcal:')}>
              Im Kalenderprogramm öffnen
            </a>
          </div>
          <p className="hinweis">
            <strong>Der Link ist wie ein Passwort.</strong> Wer ihn kennt, kann diese Termine lesen – ohne Anmeldung. Gib ihn nicht weiter. Ist er in falsche Hände geraten, erneuere ihn.
          </p>
          <p className="leise klein">
            Erstellt am {zeit(abo.erstellt ?? null)} · {abo.letzterAbruf ? `zuletzt von einem Kalenderprogramm abgerufen am ${zeit(abo.letzterAbruf)}` : 'noch von keinem Kalenderprogramm abgerufen'}
          </p>

          <details className="karte abo-hilfe">
            <summary>So trägst du den Link ein</summary>
            <dl className="erklaerung">
              <dt>iPhone, iPad, Mac</dt>
              <dd>„Im Kalenderprogramm öffnen“ antippen und „Abonnieren“ bestätigen. Oder: Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen, dort den Link einfügen.</dd>
              <dt>Outlook</dt>
              <dd>Im Kalender „Kalender hinzufügen“ → „Aus dem Internet abonnieren“ wählen und den Link einfügen. Der Kalender erscheint danach auch in der Outlook-App auf dem Handy.</dd>
              <dt>Google Kalender (Android)</dt>
              <dd>Am PC calendar.google.com öffnen: links bei „Weitere Kalender“ auf „+“ → „Per URL“, den Link einfügen. Danach erscheint der Kalender auch auf dem Handy.</dd>
            </dl>
            <ul className="punkte">
              <li>
                <strong>Änderungen kommen mit Verzögerung an.</strong> Das Kalenderprogramm holt den Plan nur alle paar Stunden, manche nur einmal am Tag. Verbindlich ist immer der Ausbildungsplan im Portal.
              </li>
              <li>Der Kalender ist nur zum Lesen. Termine änderst du im Portal, nicht im Kalenderprogramm.</li>
              <li>Enthalten sind Berufsschule, Einsätze und Prüfungstermine – als ganztägige Termine, Wochen von Montag bis Sonntag. {betreut ? 'Private Termine der Azubis stehen nicht darin. ' : 'Dazu kommen deine eigenen Termine. '}Aufgaben, Notizen und Berichte stehen nicht im Kalender.</li>
            </ul>
          </details>

          <div className="aktionen links">
            <button
              type="button"
              className="knopf schlicht"
              disabled={laeuft}
              onClick={() =>
                void rueckfrage('Kalender-Link erneuern?\n\nDer bisherige Link gilt dann sofort nicht mehr. Du musst den neuen Link in jedem Kalenderprogramm neu eintragen.', { ja: 'Link erneuern' }).then(
                  (ja) => {
                    if (ja) void tue('POST', 'Neuer Kalender-Link erstellt. Der alte gilt nicht mehr.');
                  },
                )
              }
            >
              Link erneuern
            </button>
            <button
              type="button"
              className="knopf schlicht gefahr"
              disabled={laeuft}
              onClick={() =>
                void rueckfrage('Kalender-Abo beenden?\n\nDer Link gilt dann nicht mehr; abonnierte Kalender bekommen keine Termine mehr. Du kannst jederzeit einen neuen Link erstellen.', { ja: 'Abo beenden', gefahr: true }).then(
                  (ja) => {
                    if (ja) void tue('DELETE', 'Kalender-Abo beendet. Der Link gilt nicht mehr.');
                  },
                )
              }
            >
              Abo beenden
            </button>
          </div>
        </>
      )}
    </>
  );
}
