import { useEffect, useState } from 'react';
import { api, zeit } from '../api';
import type { ProtokollEintrag } from '../api';

const AKTION: Record<string, string> = {
  anmeldung: 'Anmeldung',
  anmeldung_fehlgeschlagen: 'Anmeldung fehlgeschlagen',
  abmeldung: 'Abmeldung',
  konto_angelegt: 'Konto angelegt',
  konto_geaendert: 'Konto geändert',
  konto_gesperrt: 'Konto gesperrt',
  konto_entsperrt: 'Konto entsperrt',
  konto_geloescht: 'Konto gelöscht',
  rolle_geaendert: 'Rolle geändert',
  passwort_geaendert: 'Passwort geändert',
  passwort_zurueckgesetzt: 'Passwort zurückgesetzt',
  entra_verknuepft: 'Mit Microsoft-Konto verknüpft',
  entra_geloest: 'Verknüpfung gelöst',
  zuweisung_geaendert: 'Zuweisung geändert',
};

export function Protokoll({ nurKonto }: { nurKonto: boolean }) {
  const [eintraege, setEintraege] = useState<ProtokollEintrag[] | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<{ eintraege: ProtokollEintrag[] }>('GET', '/api/protokoll?limit=200').then((r) => setEintraege(r.eintraege), (e: Error) => setFehler(e.message));
  }, []);

  return (
    <>
      <h1>Protokoll</h1>
      <p className="leise">{nurKonto ? 'Anmeldungen und Änderungen an Konten.' : 'Anmeldungen, Änderungen an Konten und Zuweisungen.'} Die neuesten 200 Einträge.</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <div className="karte tabelle-rahmen">
        <table>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Ereignis</th>
              <th>Wer</th>
              <th>Betrifft</th>
              <th>Einzelheiten</th>
            </tr>
          </thead>
          <tbody>
            {(eintraege ?? []).map((e) => (
              <tr key={e.id}>
                <td className="eng">{zeit(e.zeit)}</td>
                <td>{AKTION[e.aktion] ?? e.aktion}</td>
                <td>{e.benutzer_name || '–'}</td>
                <td>{e.ziel_name || '–'}</td>
                <td className="leise">{e.detail}</td>
              </tr>
            ))}
            {eintraege?.length === 0 && (
              <tr>
                <td colSpan={5} className="leise">
                  Noch keine Einträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
