import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AzubiKurz, Konto } from '../api';
import { AzubiKarte } from '../AzubiKarte';
import { Link } from '../router';
import { HandbuchLink } from '../handbuchLink';

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
        {ich.rolle !== 'ausbilder' ? 'Die Auszubildenden, die dir zugewiesen sind.' : ich.alleAzubis ? 'Alle Auszubildenden des Betriebs.' : 'Die Auszubildenden, für die du zuständig bist oder die du vertrittst – und alle, die noch keinen Ausbilder haben.'} Je Azubi siehst du den Stand der Ausbildung und der Berichte; darunter geht es direkt zu Profil, Ausbildungsplan und
        Berichtsheft.{' '}
        <HandbuchLink kapitel={ich.rolle === 'ausbilder' ? 'zustaendig' : 'aufgabe'}>{ich.rolle === 'ausbilder' ? 'Meine Azubis, Übernehmen, Vertretung' : 'Deine Aufgaben'}</HandbuchLink>
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
              {ich.alleAzubis ? 'Noch keine Azubis.' : 'Du bist noch für keinen Azubi zuständig.'} Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich Azubis anlegen.
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
      {azubis?.some((a) => a.betreuung === 'ohne') && (
        <p className="hinweis">
          <strong>Ohne Ausbilder:</strong> Diese Azubis sehen alle Ausbilder, bis jemand sie übernimmt. Das geht im Profil des Azubis mit „Azubi übernehmen“.
        </p>
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
