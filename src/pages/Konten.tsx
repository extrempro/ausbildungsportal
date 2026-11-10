import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Konto, Rolle } from '../api';

interface Antwort {
  konten: Konto[];
  rollen: Rolle[];
}

export function Konten({ ich }: { ich: Konto }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [startpasswort, setStartpasswort] = useState<{ name: string; passwort: string } | null>(null);
  const [rolle, setRolle] = useState<Rolle>('azubi');

  const lade = useCallback(async () => {
    try {
      setDaten(await api<Antwort>('GET', '/api/konten'));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  }, []);

  useEffect(() => void lade(), [lade]);

  /** Führt eine Änderung aus, zeigt Fehler an und lädt die Liste neu. */
  const tue = async <T,>(aktion: () => Promise<T>): Promise<T | undefined> => {
    setFehler('');
    try {
      const r = await aktion();
      await lade();
      return r;
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
      return undefined;
    }
  };

  const anlegen = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const r = await tue(() =>
      api<{ konto: Konto; startpasswort?: string }>('POST', '/api/konten', { anmeldename: f.get('anmeldename'), anzeigename: f.get('anzeigename'), rolle }),
    );
    if (!r) return;
    form.reset();
    setStartpasswort(r.startpasswort ? { name: r.konto.anmeldename, passwort: r.startpasswort } : null);
  };

  const loeschen = (k: Konto) => {
    const frage =
      k.rolle === 'azubi'
        ? `Konto „${k.anzeigename}“ mit allen Daten dieses Azubis endgültig löschen?\n\nDas lässt sich nicht rückgängig machen. Wenn die Berichte noch gebraucht werden, vorher exportieren – oder das Konto nur sperren.`
        : `Konto „${k.anzeigename}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`;
    if (window.confirm(frage)) void tue(() => api('DELETE', `/api/konten/${k.id}`));
  };

  const zuruecksetzen = async (k: Konto) => {
    if (!window.confirm(`Passwort von „${k.anzeigename}“ zurücksetzen? Das bisherige gilt dann nicht mehr.`)) return;
    const r = await tue(() => api<{ startpasswort: string }>('POST', `/api/konten/${k.id}/passwort-zuruecksetzen`));
    if (r) setStartpasswort({ name: k.anmeldename, passwort: r.startpasswort });
  };

  const loesen = (k: Konto) => {
    if (window.confirm(`Verknüpfung von „${k.anzeigename}“ mit dem Microsoft-Konto lösen?\n\nDie nächste Anmeldung mit dem Anmeldenamen ${k.anmeldename} verknüpft das Konto neu.`)) {
      void tue(() => api('POST', `/api/konten/${k.id}/entra-loesen`));
    }
  };

  const lokal = rolle === 'admin';

  return (
    <>
      <h1>Konten</h1>
      <p className="leise">
        {ich.rolle === 'admin'
          ? 'Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto an. Hier wird festgelegt, wer Zugang hat und in welcher Rolle.'
          : 'Azubis und Ausbildungsbeauftragte melden sich mit ihrem Microsoft-Konto an. Hier wird festgelegt, wer Zugang hat.'}
      </p>

      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {startpasswort && (
        <div className="hinweis" role="status">
          <p>
            Startpasswort für <strong>{startpasswort.name}</strong> – es wird nur jetzt angezeigt und muss bei der ersten Anmeldung geändert werden:
          </p>
          <p>
            <code className="passwort">{startpasswort.passwort}</code>
          </p>
          <button className="knopf schlicht" onClick={() => setStartpasswort(null)}>
            Notiert – ausblenden
          </button>
        </div>
      )}

      <section className="karte">
        <h2>Neues Konto</h2>
        <form className="reihe" onSubmit={anlegen}>
          <label>
            Rolle
            <select value={rolle} onChange={(e) => setRolle(e.target.value as Rolle)}>
              {(daten?.rollen ?? ['azubi']).map((r) => (
                <option key={r} value={r}>
                  {ROLLE_TEXT[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {lokal ? 'Benutzername (lokal)' : 'Microsoft-Anmeldename'}
            <input
              key={lokal ? 'lokal' : 'entra'}
              name="anmeldename"
              type={lokal ? 'text' : 'email'}
              placeholder={lokal ? 'z. B. vertretung' : 'vorname.nachname@firma.de'}
              autoCapitalize="none"
              required
            />
          </label>
          <label>
            Anzeigename
            <input name="anzeigename" placeholder="Vorname Nachname" maxLength={120} required />
          </label>
          <button className="knopf">Anlegen</button>
        </form>
        <p className="leise klein">
          {lokal
            ? 'Weitere Super-Admins melden sich lokal mit Passwort an und verwalten ausschließlich Konten.'
            : 'Der Anmeldename muss so geschrieben sein wie in Microsoft Entra („User principal name“). Bei der ersten Anmeldung wird das Konto fest mit dem Microsoft-Konto verknüpft.'}
        </p>
      </section>

      <div className="karte tabelle-rahmen">
        <table className="stapel">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>Stand</th>
              <th>Letzte Anmeldung</th>
              <th>
                <span className="nur-vorleser">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(daten?.konten ?? []).map((k) => (
              <tr key={k.id}>
                <td className="kopf">
                  <strong>{k.anzeigename}</strong>
                  {k.id === ich.id && <span className="leise"> (ich)</span>}
                  <br />
                  <span className="leise klein">{k.anmeldename}</span>
                </td>
                <td data-label="Rolle">
                  {k.verwaltbar && k.rolle !== 'admin' ? (
                    <select
                      aria-label={`Rolle von ${k.anzeigename}`}
                      value={k.rolle}
                      onChange={(e) => {
                        const neu = e.target.value as Rolle;
                        if (window.confirm(`„${k.anzeigename}“ wird ${ROLLE_TEXT[neu]}. Bestehende Zuweisungen dieses Kontos entfallen. Fortfahren?`)) {
                          void tue(() => api('PATCH', `/api/konten/${k.id}`, { rolle: neu }));
                        }
                      }}
                    >
                      {(daten?.rollen ?? []).filter((r) => r !== 'admin').map((r) => (
                        <option key={r} value={r}>
                          {ROLLE_TEXT[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLLE_TEXT[k.rolle]
                  )}
                </td>
                <td data-label="Stand">
                  {k.status === 'gesperrt' ? (
                    <span className="pille grau">gesperrt</span>
                  ) : k.verknuepft ? (
                    <span className="pille gruen">aktiv</span>
                  ) : (
                    <span className="pille gelb">wartet auf erste Anmeldung</span>
                  )}
                </td>
                <td className="eng" data-label="Letzte Anmeldung">{zeit(k.letzteAnmeldung)}</td>
                <td>
                  {k.verwaltbar && (
                    <div className="aktionen">
                      <button className="knopf schlicht" onClick={() => void tue(() => api('PATCH', `/api/konten/${k.id}`, { status: k.status === 'aktiv' ? 'gesperrt' : 'aktiv' }))}>
                        {k.status === 'aktiv' ? 'Sperren' : 'Entsperren'}
                      </button>
                      {k.anmeldung === 'entra' && k.verknuepft && (
                        <button className="knopf schlicht" onClick={() => loesen(k)}>
                          Verknüpfung lösen
                        </button>
                      )}
                      {k.anmeldung === 'lokal' && ich.rolle === 'admin' && (
                        <button className="knopf schlicht" onClick={() => void zuruecksetzen(k)}>
                          Passwort zurücksetzen
                        </button>
                      )}
                      {k.loeschbar && (
                        <button className="knopf schlicht gefahr" onClick={() => loeschen(k)}>
                          Löschen
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
