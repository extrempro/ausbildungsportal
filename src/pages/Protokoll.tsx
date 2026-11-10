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
  planvorlage_uebernommen: 'Planvorlage übernommen',
  profil_geaendert: 'Azubi-Profil geändert',
  stammdaten_geaendert: 'Stammdaten geändert',
  logo_geaendert: 'Logo geändert',
  logo_entfernt: 'Logo entfernt',
};

export function Protokoll() {
  const [eintraege, setEintraege] = useState<ProtokollEintrag[] | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<{ eintraege: ProtokollEintrag[] }>('GET', '/api/protokoll?limit=200').then((r) => setEintraege(r.eintraege), (e: Error) => setFehler(e.message));
  }, []);

  return (
    <>
      <h1>Protokoll</h1>
      <p className="leise">Anmeldungen und Änderungen an Konten, Zuweisungen, Stammdaten und Azubi-Profilen. Berichte und Ausbildungspläne erscheinen hier nicht – weder ihr Inhalt noch, wer wann eingereicht oder abgezeichnet hat. Die neuesten 200 Einträge.</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      <div className="karte tabelle-rahmen">
        <table className="stapel">
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
                <td className="eng" data-label="Zeit">{zeit(e.zeit)}</td>
                <td data-label="Ereignis">{AKTION[e.aktion] ?? e.aktion}</td>
                <td data-label="Wer">{e.benutzer_name || '–'}</td>
                <td data-label="Betrifft">{e.ziel_name || '–'}</td>
                <td className="leise" data-label={e.detail ? 'Einzelheiten' : undefined}>{e.detail}</td>
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
