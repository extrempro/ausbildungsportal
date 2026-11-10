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
      {betreut && wartend !== null && (
        <section className="karte">
          <h2>Abzeichnen</h2>
          <p>
            {wartend === 0 ? 'Es wartet kein Nachweis auf dich.' : `${wartend} ${wartend === 1 ? 'Nachweis wartet' : 'Nachweise warten'} auf deine Unterschrift.`}{' '}
            {wartend > 0 && <Link zu="/abzeichnen">Zur Liste</Link>}
          </p>
        </section>
      )}

      {konto.rolle === 'azubi' && heft && !heft.beginnFehlt && (
        <section className="karte">
          <h2>Berichtsheft</h2>
          <p>
            {(() => {
              const n = (s: string) => heft.wochen.filter((w) => w.status === s).length;
              const teile = [
                n('zurueck') && `${n('zurueck')} zurückgegeben`,
                n('fehlt') && `${n('fehlt')} ${n('fehlt') === 1 ? 'Woche fehlt' : 'Wochen fehlen'}`,
                n('entwurf') && `${n('entwurf')} im Entwurf`,
                n('eingereicht') && `${n('eingereicht')} eingereicht`,
              ].filter(Boolean);
              return teile.length ? `${teile.join(' · ')}.` : 'Alle Nachweise sind abgezeichnet.';
            })()}{' '}
            <Link zu="/berichtsheft">Zum Berichtsheft</Link>
          </p>
        </section>
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
