import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT } from '../api';
import type { Konto } from '../api';
import { Link } from '../router';

interface Azubi {
  id: number;
  anzeigename: string;
  anmeldename: string;
  status: string;
}

export function Start({ konto }: { konto: Konto }) {
  const [azubis, setAzubis] = useState<Azubi[] | null>(null);
  const siehtAzubis = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';

  useEffect(() => {
    if (siehtAzubis) api<{ azubis: Azubi[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), () => setAzubis([]));
  }, [siehtAzubis]);

  return (
    <>
      <h1>Hallo {konto.anzeigename}</h1>
      <p className="leise">Angemeldet als {ROLLE_TEXT[konto.rolle]}.</p>
      <p className="hinweis">Berichtsheft und Ausbildungsplan folgen in den nächsten Ausbaustufen. Bisher gibt es Anmeldung, Konten und Rechte.</p>

      {siehtAzubis && (
        <section className="karte">
          <h2>{konto.rolle === 'ausbilder' ? 'Alle Azubis' : 'Mir zugewiesene Azubis'}</h2>
          {azubis === null ? (
            <p className="leise">Lädt …</p>
          ) : azubis.length === 0 ? (
            <p className="leise">
              {konto.rolle === 'ausbilder' ? (
                <>
                  Noch keine Azubis. Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich welche anlegen.
                </>
              ) : (
                'Dir ist noch kein Azubi zugewiesen.'
              )}
            </p>
          ) : (
            <ul className="liste">
              {azubis.map((a) => (
                <li key={a.id}>
                  <strong>{a.anzeigename}</strong> <span className="leise">{a.anmeldename}</span>
                  {a.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
