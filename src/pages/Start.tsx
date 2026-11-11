import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT } from '../api';
import { AzubiKarte } from '../AzubiKarte';
import type { AzubiKurz, Konto, OffenerBericht } from '../api';
import { Link } from '../router';

export function Start({ konto }: { konto: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [wartend, setWartend] = useState<number | null>(null);
  const betreut = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';

  useEffect(() => {
    if (betreut) api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), () => setAzubis([]));
    if (betreut) api<{ offen: OffenerBericht[] }>('GET', '/api/abzeichnen').then((r) => setWartend(r.offen.length), () => {});
  }, [betreut, konto.rolle, konto.id]);

  return (
    <>
      <h1>Hallo {konto.anzeigename}</h1>
      <p className="leise">Angemeldet als {ROLLE_TEXT[konto.rolle]}.</p>
      {betreut && (
        <div className="kacheln">
          <Link zu="/abzeichnen" className={`kachel${wartend ? ' warnung' : ''}`}>
            <span className="kachel-wert">{wartend ?? '–'}</span>
            <span className="kachel-text">{wartend === 1 ? 'Bericht wartet' : 'Berichte warten'}</span>
            <span className="kachel-zusatz">auf deine Unterschrift</span>
          </Link>
          <Link zu="/azubis" className="kachel">
            <span className="kachel-wert">{azubis?.length ?? '–'}</span>
            <span className="kachel-text">{azubis?.length === 1 ? 'Azubi' : 'Azubis'}</span>
            <span className="kachel-zusatz">{konto.rolle === 'ausbilder' ? 'im Betrieb' : 'dir zugewiesen'}</span>
          </Link>
          <Link zu="/jahreskalender" className="kachel">
            <span className="kachel-wert">12</span>
            <span className="kachel-text">Monate im Blick</span>
            <span className="kachel-zusatz">Jahreskalender: Schule, Einsätze, Urlaub</span>
          </Link>
        </div>
      )}

      {betreut && (
        <section className="start-azubis">
          <h2 className="abschnitt-titel">{konto.rolle !== 'ausbilder' ? 'Mir zugewiesene Azubis' : konto.alleAzubis ? 'Alle Azubis' : 'Meine Azubis'}</h2>
          {azubis === null ? (
            <p className="leise">Lädt …</p>
          ) : azubis.length === 0 ? (
            <p className="karte leise">
              {konto.rolle === 'ausbilder' ? (
                <>
                  {konto.alleAzubis ? 'Noch keine Azubis.' : 'Du bist noch für keinen Azubi zuständig.'} Unter <Link zu="/verwaltung/konten">Konten</Link> lassen sich Azubis anlegen.
                </>
              ) : (
                'Dir ist noch kein Azubi zugewiesen.'
              )}
            </p>
          ) : (
            <ul className="azubi-karten">
              {azubis.map((a) => (
                <AzubiKarte key={a.id} a={a} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
