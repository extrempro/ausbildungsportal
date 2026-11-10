import { useCallback, useEffect, useState } from 'react';
import { api, ROLLE_TEXT, setzeAbmeldung } from './api';
import type { Konto, Theme } from './api';
import { Anmelden } from './pages/Anmelden';
import { AzubiDetail } from './pages/AzubiDetail';
import { Azubis } from './pages/Azubis';
import { Konten } from './pages/Konten';
import { KontoSeite, PasswortFormular } from './pages/Konto';
import { Protokoll } from './pages/Protokoll';
import { Stammdaten } from './pages/Stammdaten';
import { Start } from './pages/Start';
import { geheZu, Link, usePfad } from './router';

function wendeThemeAn(theme: Theme): void {
  const dunkel = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dunkel);
}

export function App() {
  const pfad = usePfad();
  const [konto, setKonto] = useState<Konto | null | undefined>(undefined); // undefined = lädt
  const [version, setVersion] = useState('');

  const lade = useCallback(async () => {
    try {
      const r = await api<{ konto: Konto; version: string }>('GET', '/api/ich');
      setKonto(r.konto);
      setVersion(r.version);
    } catch {
      setKonto(null);
    }
  }, []);

  useEffect(() => {
    setzeAbmeldung(() => setKonto(null));
    void lade();
  }, [lade]);

  useEffect(() => wendeThemeAn(konto?.theme ?? 'auto'), [konto?.theme]);

  if (konto === undefined) return <p className="mitte leise">Lädt …</p>;
  if (konto === null) return <Anmelden />;

  const abmelden = async () => {
    await api('POST', '/api/auth/abmelden').catch(() => {});
    setKonto(null);
    geheZu('/anmelden');
  };

  if (konto.passwortWechsel) {
    return (
      <main className="schmal">
        <h1>Passwort ändern</h1>
        <p className="leise">Das Startpasswort gilt nur für die erste Anmeldung. Bitte jetzt ein eigenes Passwort vergeben.</p>
        <div className="karte">
          <PasswortFormular onFertig={lade} />
        </div>
        <button className="knopf schlicht" onClick={abmelden}>
          Abmelden
        </button>
      </main>
    );
  }

  const verwaltet = konto.rolle === 'admin' || konto.rolle === 'ausbilder';
  // der Super-Admin hat nur die Kontenverwaltung
  const start = konto.rolle === 'admin' ? '/verwaltung/konten' : '/';
  if (pfad === '/anmelden' || (konto.rolle === 'admin' && pfad === '/')) {
    queueMicrotask(() => geheZu(start));
    return null;
  }

  const betreut = konto.rolle === 'ausbilder' || konto.rolle === 'beauftragter';
  const azubiId = /^\/azubis\/(\d{1,12})$/.exec(pfad)?.[1];

  let seite;
  if (pfad === '/' && konto.rolle !== 'admin') seite = <Start konto={konto} />;
  else if (pfad === '/azubis' && betreut) seite = <Azubis ich={konto} />;
  else if (azubiId && betreut) seite = <AzubiDetail key={azubiId} id={Number(azubiId)} />;
  else if (pfad === '/verwaltung/stammdaten' && konto.rolle === 'ausbilder') seite = <Stammdaten />;
  else if (pfad === '/verwaltung/konten' && verwaltet) seite = <Konten ich={konto} />;
  else if (pfad === '/verwaltung/protokoll' && verwaltet) seite = <Protokoll nurKonto={konto.rolle === 'admin'} />;
  else if (pfad === '/konto') seite = <KontoSeite konto={konto} onGeaendert={lade} />;
  else
    seite = (
      <>
        <h1>Seite nicht gefunden</h1>
        <p>
          <Link zu={start}>Zur Startseite</Link>
        </p>
      </>
    );

  return (
    <>
      <header className="leiste">
        <div className="leiste-innen">
          <Link zu={start} className="marke">
            Ausbildungsportal
          </Link>
          <nav aria-label="Hauptnavigation">
            {konto.rolle !== 'admin' && <Link zu="/">Start</Link>}
            {betreut && (
              <Link zu="/azubis" aktivAb="/azubis">
                Azubis
              </Link>
            )}
            {verwaltet && <Link zu="/verwaltung/konten">Konten</Link>}
            {konto.rolle === 'ausbilder' && <Link zu="/verwaltung/stammdaten">Stammdaten</Link>}
            {verwaltet && <Link zu="/verwaltung/protokoll">Protokoll</Link>}
            <Link zu="/konto">Konto</Link>
          </nav>
          <div className="wer">
            <span>
              {konto.anzeigename === ROLLE_TEXT[konto.rolle] ? konto.anzeigename : `${konto.anzeigename} · ${ROLLE_TEXT[konto.rolle]}`}
            </span>
            <button className="knopf schlicht" onClick={abmelden}>
              Abmelden
            </button>
          </div>
        </div>
      </header>
      <main>{seite}</main>
      <footer className="fuss leise">Ausbildungsportal · Version {version}</footer>
    </>
  );
}
