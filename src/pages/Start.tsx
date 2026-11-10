import { useEffect, useState } from 'react';
import { api, ROLLE_TEXT, standText } from '../api';
import type { AzubiKurz, BerichtListe, Konto, OffenerBericht, ProfilAntwort } from '../api';
import { Link } from '../router';
import { ProfilUebersicht } from './AzubiDetail';

export function Start({ konto }: { konto: Konto }) {
  const [azubis, setAzubis] = useState<AzubiKurz[] | null>(null);
  const [profil, setProfil] = useState<ProfilAntwort | null>(null);
  const [heft, setHeft] = useState<BerichtListe | null>(null);
  const [wartend, setWartend] = useState<number | null>(null);
  const betreut = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';

  useEffect(() => {
    if (betreut) api<{ azubis: AzubiKurz[] }>('GET', '/api/azubis').then((r) => setAzubis(r.azubis), () => setAzubis([]));
    if (betreut) api<{ offen: OffenerBericht[] }>('GET', '/api/abzeichnen').then((r) => setWartend(r.offen.length), () => {});
    if (konto.rolle === 'azubi') {
      api<ProfilAntwort>('GET', `/api/azubis/${konto.id}/profil`).then(setProfil, () => {});
      api<BerichtListe>('GET', `/api/azubis/${konto.id}/berichte`).then(setHeft, () => {});
    }
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
          <Link zu="/uebersicht" className="kachel">
            <span className="kachel-wert">26</span>
            <span className="kachel-text">Wochen im Blick</span>
            <span className="kachel-zusatz">Schule, Einsätze, Urlaub</span>
          </Link>
        </div>
      )}

      {konto.rolle === 'azubi' && heft && !heft.beginnFehlt && (
        <div className="kacheln">
          {(() => {
            const n = (st: string) => heft.wochen.filter((w) => w.status === st).length;
            return (
              <>
                <Link zu="/berichtsheft" className={`kachel${n('zurueck') ? ' warnung' : ''}`}>
                  <span className="kachel-wert">{n('zurueck')}</span>
                  <span className="kachel-text">zurückgegeben</span>
                  <span className="kachel-zusatz">bitte überarbeiten</span>
                </Link>
                <Link zu="/berichtsheft" className={`kachel${n('fehlt') ? ' warnung' : ''}`}>
                  <span className="kachel-wert">{n('fehlt')}</span>
                  <span className="kachel-text">{n('fehlt') === 1 ? 'Bericht fehlt' : 'Berichte fehlen'}</span>
                  <span className="kachel-zusatz">{n('entwurf') ? `${n('entwurf')} im Entwurf` : 'kein Entwurf offen'}</span>
                </Link>
                <Link zu="/berichtsheft" className="kachel">
                  <span className="kachel-wert">{n('eingereicht')}</span>
                  <span className="kachel-text">eingereicht</span>
                  <span className="kachel-zusatz">{n('abgezeichnet')} abgezeichnet</span>
                </Link>
                <Link zu="/plan" className="kachel">
                  <span className="kachel-wert">{profil?.stand.ausbildungsjahr ? `${profil.stand.ausbildungsjahr}.` : '–'}</span>
                  <span className="kachel-text">Ausbildungsjahr</span>
                  <span className="kachel-zusatz">zum Ausbildungsplan</span>
                </Link>
              </>
            );
          })()}
        </div>
      )}

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
