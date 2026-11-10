import { useEffect, useState } from 'react';
import { api, standText } from '../api';
import type { AzubiKurz, Konto } from '../api';
import { Link } from '../router';

export function Azubis({ ich }: { ich: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), (e: Error) => setFehler(e.message));
  }, []);

  return (
    <>
      <h1>Azubis</h1>
      <p className="leise">{ich.rolle === 'ausbilder' ? 'Alle Auszubildenden des Betriebs.' : 'Die Auszubildenden, die dir zugewiesen sind.'}</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {azubis?.length === 0 ? (
        <p className="karte leise">
          {ich.rolle === 'ausbilder' ? (
            <>
              Noch keine Azubis. Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich welche anlegen.
            </>
          ) : (
            'Dir ist noch kein Azubi zugewiesen.'
          )}
        </p>
      ) : (
        <div className="karte tabelle-rahmen">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Beruf</th>
                <th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {(azubis ?? []).map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link zu={`/azubis/${a.id}`}>
                      <strong>{a.anzeigename}</strong>
                    </Link>
                    {a.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
                    <br />
                    <span className="leise klein">{a.anmeldename}</span>
                  </td>
                  <td>{a.beruf || <span className="leise">noch nicht eingetragen</span>}</td>
                  <td>{standText(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
