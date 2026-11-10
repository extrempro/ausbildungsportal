import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT, standText } from '../api';
import type { AzubiKurz, Konto, ProfilAntwort } from '../api';
import { Link } from '../router';
import { ProfilUebersicht } from './AzubiDetail';

export function Start({ konto }: { konto: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [profil, setProfil] = useState<ProfilAntwort | null>(null);
  const betreut = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';

  useEffect(() => {
    if (betreut) api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), () => setAzubis([]));
    if (konto.rolle === 'azubi') api<ProfilAntwort>('GET', `/api/azubis/${konto.id}/profil`).then(setProfil, () => {});
  }, [betreut, konto.rolle, konto.id]);

  return (
    <>
      <h1>Hallo {konto.anzeigename}</h1>
      <p className="leise">Angemeldet als {ROLLE_TEXT[konto.rolle]}.</p>
      <p className="hinweis">Berichtsheft und Ausbildungsplan folgen in den nächsten Ausbaustufen.</p>

      {konto.rolle === 'azubi' && (
        <section className="karte">
          <h2>Meine Ausbildung</h2>
          {profil ? (
            <>
              <ProfilUebersicht p={profil} />
              {profil.stand.phase === 'offen' && <p className="leise klein">Die Angaben trägt dein Ausbilder ein.</p>}
            </>
          ) : (
            <p className="leise">Lädt …</p>
          )}
        </section>
      )}

      {betreut && (
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
                  <Link zu={`/azubis/${a.id}`}>
                    <strong>{a.anzeigename}</strong>
                  </Link>{' '}
                  <span className="leise">
                    {a.beruf ? `${a.beruf} · ` : ''}
                    {standText(a)}
                  </span>
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
