import { melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Konto, Rolle } from '../api';
import { Icon } from '../icons';
import { HandbuchLink } from '../handbuchLink';

const HILFE = 'konten-hilfe';
function hilfeOffen(): boolean {
  try {
    return localStorage.getItem(HILFE) !== '0';
  } catch {
    return true;
  }
}

interface Antwort {
  konten: Konto[];
  rollen: Rolle[];
}

export function Konten({ ich }: { ich: Konto }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [startpasswort, setStartpasswort] = useState<{ name: string; passwort: string } | null>(null);
  const [rolle, setRolle] = useState<Rolle>('azubi');
  const [hilfe, setHilfe] = useState(hilfeOffen);
  const [meldung, setMeldung] = useState('');
  const schalteHilfe = () => {
    setHilfe(!hilfe);
    try {
      localStorage.setItem(HILFE, hilfe ? '0' : '1');
    } catch {
      // ohne Speicher bleibt die Erklärung beim nächsten Besuch offen
    }
  };

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
    setMeldung('');
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
    if (!r.startpasswort) setMeldung(`Konto für ${r.konto.anzeigename} angelegt. Es wird keine E-Mail verschickt – bitte gib der Person selbst Bescheid, dass sie sich jetzt mit ihrem Microsoft-Konto anmelden kann.`);
    setStartpasswort(r.startpasswort ? { name: r.konto.anmeldename, passwort: r.startpasswort } : null);
  };

  const loeschen = async (k: Konto) => {
    const text =
      k.rolle === 'azubi'
        ? `Konto „${k.anzeigename}“ mit allen Daten dieses Azubis endgültig löschen?\n\nDas lässt sich nicht rückgängig machen. Wenn die Berichte noch gebraucht werden, vorher exportieren – oder das Konto nur sperren.`
        : `Konto „${k.anzeigename}“ endgültig löschen?\n\nDas lässt sich nicht rückgängig machen. Zuweisungen zu Azubis entfallen. Bereits abgezeichnete Berichte bleiben mit Name und Unterschrift gültig.`;
    if (!(await rueckfrage(text, { ja: 'Konto endgültig löschen', gefahr: true }))) return;
    if ((await tue(() => api('DELETE', `/api/konten/${k.id}`))) !== undefined) melde(`Konto „${k.anzeigename}“ gelöscht.`);
  };

  const zuruecksetzen = async (k: Konto) => {
    if (!(await rueckfrage(`Passwort von „${k.anzeigename}“ zurücksetzen?\n\nDas bisherige Passwort gilt sofort nicht mehr und die Person wird überall abgemeldet. Du bekommst ein Startpasswort angezeigt, das du ihr weitergibst.`, { ja: 'Passwort zurücksetzen' }))) return;
    const r = await tue(() => api<{ startpasswort: string }>('POST', `/api/konten/${k.id}/passwort-zuruecksetzen`));
    if (r) setStartpasswort({ name: k.anmeldename, passwort: r.startpasswort });
  };

  const loesen = async (k: Konto) => {
    const ja = await rueckfrage(
      `Verknüpfung von „${k.anzeigename}“ mit dem Microsoft-Konto lösen?\n\nNur nötig, wenn das Microsoft-Konto neu angelegt wurde oder sich beim ersten Mal die falsche Person angemeldet hat. Es gehen keine Daten verloren.\n\nDie Person wird abgemeldet; die nächste Anmeldung mit ${k.anmeldename} verknüpft das Konto neu.`,
      { ja: 'Verknüpfung lösen' },
    );
    if (ja && (await tue(() => api('POST', `/api/konten/${k.id}/entra-loesen`))) !== undefined) melde(`Verknüpfung von „${k.anzeigename}“ gelöst. Das Konto wartet jetzt wieder auf die erste Anmeldung.`);
  };


  const lokal = rolle === 'admin';

  return (
    <>
      <h1>Konten</h1>
      <p className="leise">
        {ich.rolle === 'admin'
          ? 'Azubis, Ausbildungsbeauftragte und Ausbilder melden sich mit ihrem Microsoft-Konto an. Hier wird festgelegt, wer Zugang hat und in welcher Rolle.'
          : 'Azubis und Ausbildungsbeauftragte melden sich mit ihrem Microsoft-Konto an. Hier wird festgelegt, wer Zugang hat.'}{' '}
        <HandbuchLink kapitel="konten">Konten verwalten</HandbuchLink>
      </p>

      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {meldung && (
        <p className="hinweis gut" role="status">
          {meldung}
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

      <section className={`karte anleitung${hilfe ? '' : ' zu'}`}>
        <button type="button" className="anleitung-kopf" aria-expanded={hilfe} aria-controls="konten-hilfe" onClick={schalteHilfe}>
          <Icon name="hilfe" />
          <span className="anleitung-titel">Was bewirkt was?</span>
          <span className="anleitung-schalter">
            {hilfe ? 'Einklappen' : 'Anzeigen'}
          </span>
        </button>
        {hilfe && (
          <div id="konten-hilfe" className="konten-hilfe">
            <h2>Rollen</h2>
            <dl className="erklaerung">
              <dt>Azubi</dt>
              <dd>Sieht nur den eigenen Ausbildungsplan und das eigene Berichtsheft. Schreibt Berichte und reicht sie ein.</dd>
              <dt>Ausbildungsbeauftragte</dt>
              <dd>Betreut die Azubis, die ihr oder ihm zugewiesen sind: Plan und Berichte lesen, Berichte abzeichnen, Aufgaben und Notizen eintragen. Andere Azubis sind nicht sichtbar. Die Zuweisung geschieht im Profil des Azubis.</dd>
              {ich.rolle === 'admin' && (
                <>
                  <dt>Ausbilder</dt>
                  <dd>
                    Plant die Ausbildung, zeichnet Berichte ab, pflegt Stammdaten und verwaltet die Konten seiner Azubis und der Ausbildungsbeauftragten. Sieht <strong>nur die eigenen Azubis</strong> (im Profil als zuständiger Ausbilder eingetragen), Azubis ohne
                    Ausbilder und Azubis, die er für einen Zeitraum vertritt.
                  </dd>
                  <dt>Super-Admin</dt>
                  <dd>Betreibt das Portal: Konten, Protokoll, Fehlermeldungen und Logo. Sieht keine Pläne, Berichte oder Stammdaten. Meldet sich als Einziger mit Benutzername und Passwort an.</dd>
                </>
              )}
            </dl>
            <h2>Funktionen</h2>
            <dl className="erklaerung">
              <dt>Konto anlegen</dt>
              <dd>
                Gibt einer Person Zugang. Ab sofort kann sie sich {ich.rolle === 'admin' ? 'mit ihrem Microsoft-Konto (Super-Admins: mit dem Startpasswort) ' : 'mit ihrem Microsoft-Konto '}
                anmelden. Das Portal verschickt keine E-Mail – sag der Person selbst Bescheid. Ohne Konto hier kommt niemand hinein, auch nicht mit gültigem Microsoft-Konto.
              </dd>
              <dt>Rolle ändern</dt>
              <dd>
                Wirkt sofort; die Person wird abgemeldet und sieht nach der nächsten Anmeldung die neue Ansicht. <strong>Alle Zuweisungen dieses Kontos entfallen</strong> und müssen neu gesetzt werden; war die Person Ausbilder, haben ihre Azubis danach keinen zuständigen Ausbilder mehr. Berichte und Plan bleiben gespeichert. Gedacht für echte Wechsel, zum Beispiel wenn ein
                früherer Azubi Ausbildungsbeauftragter wird.
              </dd>
              {ich.rolle === 'admin' && (
                <>
                  <dt>Sieht alle Azubis (Gesamtsicht)</dt>
                  <dd>
                    Nur bei Ausbildern. Mit Haken sieht und bearbeitet die Person <strong>alle Azubis des Betriebs</strong>, nicht nur die eigenen – gedacht für die Ausbildungsleitung. Wirkt sofort und lässt sich jederzeit wieder ausschalten. Ohne Haken bleibt es bei den eigenen
                    Azubis.
                  </dd>
                </>
              )}
              <dt>Sperren / Entsperren</dt>
              <dd>
                Sperren meldet die Person sofort ab und verhindert jede weitere Anmeldung. Alle Daten bleiben erhalten, Entsperren macht es rückgängig. Solange ein Ausbilder gesperrt ist, gelten seine Azubis als „ohne Ausbilder“ und sind für alle Ausbilder sichtbar. Gedacht für Pausen und fürs Ausscheiden, solange die Berichte noch gebraucht werden – im Zweifel sperren statt löschen.
              </dd>
              <dt>Verknüpfung lösen</dt>
              <dd>
                Bei der ersten Anmeldung merkt sich das Portal das Microsoft-Konto der Person fest. Lösen brauchst du nur, wenn die IT das Microsoft-Konto neu angelegt hat oder sich beim ersten Mal jemand Falsches angemeldet hat. Es gehen keine Daten verloren; die nächste Anmeldung
                verknüpft neu.
              </dd>
              {ich.rolle === 'admin' && (
                <>
                  <dt>Passwort zurücksetzen</dt>
                  <dd>Nur für Super-Admin-Konten. Das alte Passwort gilt sofort nicht mehr, du bekommst einmalig ein Startpasswort angezeigt. Bei der nächsten Anmeldung muss ein eigenes Passwort vergeben werden. Passwörter von Microsoft-Konten verwaltet Microsoft, nicht das Portal.</dd>
                </>
              )}
              <dt>Löschen</dt>
              <dd>
                Endgültig, ohne Papierkorb. <strong>Bei einem Azubi werden alle Berichte, der Ausbildungsplan, das Profil und die Zuweisungen mit gelöscht.</strong> Bei Ausbildungsbeauftragten{ich.rolle === 'admin' ? ' und Ausbildern' : ''} entfallen die Zuweisungen; bereits abgezeichnete
                Berichte bleiben mit Name und Unterschrift gültig. Gedacht für das Ende der Aufbewahrung, nicht für eine Pause.
              </dd>
            </dl>
            <h2>Stand</h2>
            <dl className="erklaerung">
              <dt>
                <span className="pille gelb">wartet auf erste Anmeldung</span>
              </dt>
              <dd>Das Konto ist angelegt, die Person hat sich aber noch nie angemeldet.</dd>
              <dt>
                <span className="pille gruen">aktiv</span>
              </dt>
              <dd>Die Person hat sich angemeldet und kann das Portal nutzen.</dd>
              <dt>
                <span className="pille grau">gesperrt</span>
              </dt>
              <dd>Anmeldung nicht möglich, Daten bleiben erhalten.</dd>
            </dl>
            <p className="leise klein">Das eigene Konto lässt sich weder sperren noch löschen. Jede Änderung an Konten steht mit deinem Namen im Protokoll, das der Super-Admin einsehen kann.</p>
          </div>
        )}
      </section>

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
          <button className="knopf">Konto anlegen</button>
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
                        void rueckfrage(`„${k.anzeigename}“ wird ${ROLLE_TEXT[neu]}. Fortfahren?\n\nDie Person wird abgemeldet und sieht danach die neue Ansicht.\n\nAlle Zuweisungen dieses Kontos entfallen und müssen neu gesetzt werden. Berichte und Plan bleiben gespeichert.`, { ja: 'Rolle ändern' }).then(async (ja) => {
                          if (ja && (await tue(() => api('PATCH', `/api/konten/${k.id}`, { rolle: neu }))) !== undefined) melde(`„${k.anzeigename}“ ist jetzt ${ROLLE_TEXT[neu]}.`);
                        });
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
                  {k.rolle === 'ausbilder' &&
                    (ich.rolle === 'admin' ? (
                      <label className="haken klein">
                        <input
                          type="checkbox"
                          checked={k.alleAzubis}
                          onChange={() => {
                            const an = !k.alleAzubis;
                            void rueckfrage(
                              an
                                ? `„${k.anzeigename}“ die Gesamtsicht geben?\n\nDie Person sieht und bearbeitet dann alle Azubis des Betriebs – Profile, Pläne und Berichte –, nicht nur die eigenen.`
                                : `„${k.anzeigename}“ die Gesamtsicht nehmen?\n\nDie Person sieht dann nur noch die eigenen Azubis, Azubis ohne Ausbilder und Vertretungen.`,
                              { ja: an ? 'Gesamtsicht geben' : 'Gesamtsicht nehmen' },
                            ).then(async (ja) => {
                              if (ja && (await tue(() => api('PATCH', `/api/konten/${k.id}`, { alleAzubis: an }))) !== undefined) melde(an ? `„${k.anzeigename}“ sieht jetzt alle Azubis.` : `„${k.anzeigename}“ sieht jetzt nur noch die eigenen Azubis.`);
                            });
                          }}
                        />
                        sieht alle Azubis
                      </label>
                    ) : (
                      k.alleAzubis && <span className="leise klein"> · sieht alle Azubis</span>
                    ))}
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
                      <button
                        className="knopf schlicht"
                        title={k.status === 'aktiv' ? 'Meldet die Person ab und verhindert die Anmeldung. Daten bleiben erhalten.' : 'Erlaubt die Anmeldung wieder.'}
                        onClick={() =>
                          void tue(() => api('PATCH', `/api/konten/${k.id}`, { status: k.status === 'aktiv' ? 'gesperrt' : 'aktiv' })).then(
                            (r) => r !== undefined && melde(k.status === 'aktiv' ? `„${k.anzeigename}“ ist gesperrt und wurde abgemeldet. Alle Daten bleiben erhalten.` : `„${k.anzeigename}“ kann sich wieder anmelden.`),
                          )
                        }
                      >
                        {k.status === 'aktiv' ? 'Sperren' : 'Entsperren'}
                      </button>
                      {k.anmeldung === 'entra' && k.verknuepft && (
                        <button className="knopf schlicht" title="Nur nötig, wenn das Microsoft-Konto neu angelegt wurde. Es gehen keine Daten verloren." onClick={() => loesen(k)}>
                          Verknüpfung lösen
                        </button>
                      )}
                      {k.anmeldung === 'lokal' && ich.rolle === 'admin' && (
                        <button className="knopf schlicht" onClick={() => void zuruecksetzen(k)}>
                          Passwort zurücksetzen
                        </button>
                      )}
                      {k.loeschbar && (
                        <button className="knopf schlicht gefahr" title={k.rolle === 'azubi' ? 'Endgültig – löscht auch alle Berichte und den Plan dieses Azubis.' : 'Endgültig. Abgezeichnete Berichte bleiben gültig.'} onClick={() => loeschen(k)}>
                          Konto löschen
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
