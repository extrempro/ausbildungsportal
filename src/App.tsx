import { useCallback, useEffect, useState } from 'react';
import { api, ROLLE_TEXT, setzeAbmeldung } from './api';
import type { Konto, Theme } from './api';
import { Anmelden } from './pages/Anmelden';
import { AzubiDetail } from './pages/AzubiDetail';
import { Azubis } from './pages/Azubis';
import { BerichtSeite } from './pages/Bericht';
import { Abzeichnen, BerichteDruck, Berichtsheft } from './pages/Berichtsheft';
import { Konten } from './pages/Konten';
import { PlanSeite } from './pages/Plan';
import { UebersichtSeite } from './pages/Uebersicht';
import { Versionen } from './pages/Versionen';
import { Vorlagen } from './pages/Vorlagen';
import { KontoSeite, PasswortFormular } from './pages/Konto';
import { Protokoll } from './pages/Protokoll';
import { Stammdaten } from './pages/Stammdaten';
import { Start } from './pages/Start';
import { geheZu, Link, usePfad } from './router';

function wendeThemeAn(theme: Theme): boolean {
  const dunkel = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dunkel);
  // fürs nächste Laden merken, damit die Seite nicht erst hell aufblitzt (siehe main.tsx)
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // ohne Speicher gilt das Schema erst nach dem Laden des Kontos
  }
  return dunkel;
}

export function App() {
  const pfad = usePfad();
  const [konto, setKonto] = useState<Konto | null | undefined>(undefined); // undefined = lädt
  const [version, setVersion] = useState('');
  const [dunkel, setDunkel] = useState(false);

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

  useEffect(() => {
    if (konto) setDunkel(wendeThemeAn(konto.theme));
  }, [konto]);

  // Höhe der festen Kopfzeile als CSS-Variable – daran richten sich Seitenleisten und Sprungziele aus
  useEffect(() => {
    const leiste = document.querySelector('.leiste');
    if (!leiste) return;
    const setze = () => document.documentElement.style.setProperty('--kopf', `${Math.round(leiste.getBoundingClientRect().height)}px`);
    setze();
    const beobachter = new ResizeObserver(setze);
    beobachter.observe(leiste);
    return () => beobachter.disconnect();
  }, [konto?.id, konto?.passwortWechsel]);

  if (konto === undefined) return <p className="mitte leise">Lädt …</p>;
  if (konto === null) return <Anmelden />;

  // Schalter in der Kopfzeile: wechselt fest auf hell oder dunkel; „automatisch“ gibt es unter Konto
  const wechsleTheme = async () => {
    const theme: Theme = dunkel ? 'light' : 'dark';
    setDunkel(wendeThemeAn(theme));
    await api('PUT', '/api/ich/theme', { theme }).catch(() => {});
    await lade();
  };

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
  // Berichtsheft: das eigene (/berichtsheft…) oder das eines betreuten Azubis (/azubis/12/berichtsheft…)
  const heft = /^(?:\/azubis\/(\d{1,12}))?\/berichtsheft(?:\/(druck|\d{4}-\d{2}-\d{2}))?$/.exec(pfad);
  const heftAzubi = heft ? (heft[1] ? (betreut ? Number(heft[1]) : null) : konto.rolle === 'azubi' ? konto.id : null) : null;

  const plan = /^(?:\/azubis\/(\d{1,12}))?\/plan$/.exec(pfad);
  const planAzubi = plan ? (plan[1] ? (betreut ? Number(plan[1]) : null) : konto.rolle === 'azubi' ? konto.id : null) : null;

  let seite;
  if (pfad === '/' && konto.rolle !== 'admin') seite = <Start konto={konto} />;
  else if (heft && heftAzubi !== null && heft[2] === 'druck') seite = <BerichteDruck key={heftAzubi} azubiId={heftAzubi} />;
  else if (heft && heftAzubi !== null && heft[2]) seite = <BerichtSeite key={`${heftAzubi}-${heft[2]}`} azubiId={heftAzubi} montag={heft[2]} eigenes={!heft[1]} />;
  else if (heft && heftAzubi !== null) seite = <Berichtsheft key={heftAzubi} azubiId={heftAzubi} />;
  else if (plan && planAzubi !== null) seite = <PlanSeite key={planAzubi} azubiId={planAzubi} />;
  else if (pfad === '/uebersicht' && betreut) seite = <UebersichtSeite />;
  else if (pfad === '/verwaltung/vorlagen' && konto.rolle === 'ausbilder') seite = <Vorlagen />;
  else if (pfad === '/versionen') seite = <Versionen />;
  else if (pfad === '/abzeichnen' && betreut) seite = <Abzeichnen />;
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
            {konto.rolle === 'azubi' && (
              <Link zu="/berichtsheft" aktivAb="/berichtsheft">
                Berichtsheft
              </Link>
            )}
            {betreut && (
              <Link zu="/azubis" aktivAb="/azubis">
                Azubis
              </Link>
            )}
            {konto.rolle === 'azubi' && <Link zu="/plan">Ausbildungsplan</Link>}
            {betreut && <Link zu="/abzeichnen">Abzeichnen</Link>}
            {betreut && <Link zu="/uebersicht">Übersicht</Link>}
            {verwaltet && <Link zu="/verwaltung/konten">Konten</Link>}
            {konto.rolle === 'ausbilder' && <Link zu="/verwaltung/stammdaten">Stammdaten</Link>}
            {verwaltet && <Link zu="/verwaltung/protokoll">Protokoll</Link>}
            <Link zu="/konto">Konto</Link>
          </nav>
          <div className="wer">
            <span>
              {konto.anzeigename === ROLLE_TEXT[konto.rolle] ? konto.anzeigename : `${konto.anzeigename} · ${ROLLE_TEXT[konto.rolle]}`}
            </span>
            <button type="button" className="knopf schlicht symbol" onClick={() => void wechsleTheme()} aria-label={dunkel ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'} title={dunkel ? 'Hell' : 'Dunkel'}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {dunkel ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </>
                ) : (
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                )}
              </svg>
            </button>
            <button className="knopf schlicht" onClick={abmelden}>
              Abmelden
            </button>
          </div>
        </div>
      </header>
      <main>{seite}</main>
      <footer className="fuss leise">
        Ausbildungsportal · Version {version} · <Link zu="/versionen">Versionshinweise</Link>
      </footer>
    </>
  );
}
