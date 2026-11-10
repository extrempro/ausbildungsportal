import { useCallback, useEffect, useState } from 'react';
import { api, ROLLE_TEXT, setzeAbmeldung } from './api';
import type { Konto, Theme } from './api';
import { Anmelden } from './pages/Anmelden';
import { Konten } from './pages/Konten';
import { KontoSeite, PasswortFormular } from './pages/Konto';
import { Protokoll } from './pages/Protokoll';
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

  let seite;
  if (pfad === '/' && konto.rolle !== 'admin') seite = <Start konto={konto} />;
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
            {verwaltet && <Link zu="/verwaltung/konten">Konten</Link>}
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
