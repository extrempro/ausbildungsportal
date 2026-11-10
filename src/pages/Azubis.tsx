import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AzubiKurz, Konto } from '../api';
import { AzubiKarte } from '../AzubiKarte';
import { Link } from '../router';

export function Azubis({ ich }: { ich: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [suche, setSuche] = useState('');

  useEffect(() => {
    api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), (e: Error) => setFehler(e.message));
  }, []);

  const wort = suche.trim().toLowerCase();
  const sichtbar = (azubis ?? []).filter((a) => !wort || `${a.anzeigename} ${a.beruf}`.toLowerCase().includes(wort));

  return (
    <>
      <h1>Azubis</h1>
      <p className="leise">
        {ich.rolle === 'ausbilder' ? 'Alle Auszubildenden des Betriebs.' : 'Die Auszubildenden, die dir zugewiesen sind.'} Je Azubi siehst du den Stand der Ausbildung und der Berichte; darunter geht es direkt zu Profil, Ausbildungsplan und
        Berichtsheft.
      </p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {azubis === null && !fehler && <p className="leise">Lädt …</p>}
      {azubis?.length === 0 && (
        <p className="karte leise">
          {ich.rolle === 'ausbilder' ? (
            <>
              Noch keine Azubis. Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich welche anlegen.
            </>
          ) : (
            'Dir ist noch kein Azubi zugewiesen.'
          )}
        </p>
      )}
      {azubis && azubis.length > 4 && (
        <label className="suche">
          Azubi suchen
          <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name oder Beruf" />
        </label>
      )}
      {sichtbar.length > 0 && (
        <ul className="azubi-karten">
          {sichtbar.map((a) => (
            <AzubiKarte key={a.id} a={a} />
          ))}
        </ul>
      )}
      {azubis && azubis.length > 0 && sichtbar.length === 0 && <p className="karte leise">Kein Azubi passt zu „{suche}“.</p>}
    </>
  );
}
