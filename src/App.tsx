import { useCallback, useEffect, useRef, useState } from 'react';
import { api, logoFuer, ROLLE_TEXT, setzeAbmeldung } from './api';
import type { Konto, Logos, Theme } from './api';
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
import { Erscheinungsbild } from './pages/Erscheinungsbild';
import { Handbuch } from './pages/Handbuch';
import { Icon } from './icons';
import type { IconName } from './icons';
import { geheZu, Link, usePfad } from './router';

interface Punkt {
  zu: string;
  text: string;
  /** kurzer Name für die Leiste unten */
  kurz?: string;
  icon: IconName;
  aktivAb?: string;
}
type Menue = 'verwaltung' | 'ich' | 'mehr' | null;

function wendeThemeAn(theme: Theme): boolean {
  const dunkel = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dunkel);
  // Farbe der Browser- und Statusleiste (Android) passend zur Kopfzeile
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? '#1e293b' : '#ffffff');
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
  const [menue, setMenue] = useState<Menue>(null);
  const [logos, setLogos] = useState<Logos>({ logo: null, logoDunkel: null });
  // Android/Chrome meldet, wenn sich das Portal als App installieren lässt; iOS kennt das nicht (dort über „Teilen“)
  const [installation, setInstallation] = useState<{ prompt: () => Promise<unknown> } | null>(null);
  useEffect(() => {
    const merke = (e: Event) => {
      e.preventDefault();
      setInstallation(e as unknown as { prompt: () => Promise<unknown> });
    };
    const fertig = () => setInstallation(null);
    window.addEventListener('beforeinstallprompt', merke);
    window.addEventListener('appinstalled', fertig);
    return () => {
      window.removeEventListener('beforeinstallprompt', merke);
      window.removeEventListener('appinstalled', fertig);
    };
  }, []);

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
    api<Logos>('GET', '/api/branding').then(setLogos, () => {});
  }, [lade]);

  useEffect(() => {
    if (konto) setDunkel(wendeThemeAn(konto.theme));
  }, [konto]);

  // Menüs schließen sich beim Seitenwechsel, mit Escape und bei einem Klick daneben
  useEffect(() => setMenue(null), [pfad]);
  useEffect(() => {
    if (!menue) return;
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setMenue(null);
    const klick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.menue, .tabs, .bogen')) setMenue(null);
    };
    window.addEventListener('keydown', taste);
    window.addEventListener('mousedown', klick);
    return () => {
      window.removeEventListener('keydown', taste);
      window.removeEventListener('mousedown', klick);
    };
  }, [menue]);

  // Seitentitel folgt der Überschrift der Seite (Verlauf, Lesezeichen, Bildschirmleser, App-Umschalter)
  useEffect(() => {
    const inhalt = document.getElementById('inhalt');
    if (!inhalt) return;
    const setze = () => {
      const h1 = inhalt.querySelector('h1');
      const text = [...(h1?.childNodes ?? [])].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
      document.title = text ? `${text} – Ausbildungsportal` : 'Ausbildungsportal';
    };
    setze();
    const beobachter = new MutationObserver(setze);
    beobachter.observe(inhalt, { childList: true, subtree: true, characterData: true });
    return () => beobachter.disconnect();
  }, [konto?.id, konto?.passwortWechsel]);

  // Nach einem Seitenwechsel steht der Fokus am Anfang des Inhalts, nicht mehr im Menü
  const ersterPfad = useRef(pfad);
  useEffect(() => {
    if (ersterPfad.current === pfad) return;
    ersterPfad.current = pfad;
    document.getElementById('inhalt')?.focus({ preventScroll: true });
  }, [pfad]);

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
    setMenue(null);
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

  // Plan eines betreuten Azubis; der eigene Plan des Azubis ist seine Startseite
  const plan = /^\/azubis\/(\d{1,12})\/plan$/.exec(pfad);
  const planAzubi = plan && betreut ? Number(plan[1]) : null;
  // alte Adressen
  if ((pfad === '/plan' && konto.rolle === 'azubi') || pfad === '/hilfe') {
    queueMicrotask(() => geheZu(pfad === '/hilfe' ? '/handbuch' : '/'));
    return null;
  }

  let seite;
  if (pfad === '/' && konto.rolle === 'azubi') seite = <PlanSeite key={konto.id} azubiId={konto.id} />;
  else if (pfad === '/' && konto.rolle !== 'admin') seite = <Start konto={konto} />;
  else if (heft && heftAzubi !== null && heft[2] === 'druck') seite = <BerichteDruck key={heftAzubi} azubiId={heftAzubi} />;
  else if (heft && heftAzubi !== null && heft[2]) seite = <BerichtSeite key={`${heftAzubi}-${heft[2]}`} azubiId={heftAzubi} montag={heft[2]} eigenes={!heft[1]} />;
  else if (heft && heftAzubi !== null) seite = <Berichtsheft key={heftAzubi} azubiId={heftAzubi} />;
  else if (plan && planAzubi !== null) seite = <PlanSeite key={planAzubi} azubiId={planAzubi} />;
  else if (pfad === '/uebersicht' && betreut) seite = <UebersichtSeite />;
  else if (pfad === '/verwaltung/vorlagen' && konto.rolle === 'ausbilder') seite = <Vorlagen />;
  else if (pfad === '/versionen') seite = <Versionen />;
  else if (pfad === '/handbuch') seite = <Handbuch rolle={konto.rolle} />;
  else if (pfad === '/verwaltung/erscheinungsbild' && konto.rolle === 'admin') seite = <Erscheinungsbild logos={logos} onGeaendert={setLogos} />;
  else if (pfad === '/abzeichnen' && betreut) seite = <Abzeichnen />;
  else if (pfad === '/azubis' && betreut) seite = <Azubis ich={konto} />;
  else if (azubiId && betreut) seite = <AzubiDetail key={azubiId} id={Number(azubiId)} />;
  else if (pfad === '/verwaltung/stammdaten' && konto.rolle === 'ausbilder') seite = <Stammdaten />;
  else if (pfad === '/verwaltung/konten' && verwaltet) seite = <Konten ich={konto} />;
  else if (pfad === '/verwaltung/protokoll' && konto.rolle === 'admin') seite = <Protokoll />;
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

  // ---------- Navigation je Rolle ----------
  const haupt: Punkt[] =
    konto.rolle === 'admin'
      ? [
          { zu: '/verwaltung/konten', text: 'Konten', icon: 'konten' },
          { zu: '/verwaltung/protokoll', text: 'Protokoll', icon: 'protokoll' },
          { zu: '/verwaltung/erscheinungsbild', text: 'Erscheinungsbild', kurz: 'Logo', icon: 'vorlagen' },
        ]
      : konto.rolle === 'azubi'
        ? [
            // die Startseite des Azubis ist sein Ausbildungsplan
            { zu: '/', text: 'Ausbildungsplan', kurz: 'Plan', icon: 'plan' },
            { zu: '/berichtsheft', text: 'Berichtsheft', icon: 'heft', aktivAb: '/berichtsheft' },
          ]
        : [
            { zu: '/', text: 'Start', icon: 'start' },
            { zu: '/azubis', text: 'Azubis', icon: 'azubis', aktivAb: '/azubis' },
            { zu: '/abzeichnen', text: 'Abzeichnen', icon: 'abzeichnen' },
            { zu: '/uebersicht', text: 'Übersicht', icon: 'uebersicht' },
          ];
  const verwaltung: Punkt[] =
    konto.rolle === 'ausbilder'
      ? [
          { zu: '/verwaltung/konten', text: 'Konten', icon: 'konten' },
          { zu: '/verwaltung/stammdaten', text: 'Stammdaten', icon: 'stammdaten' },
          { zu: '/verwaltung/vorlagen', text: 'Planvorlagen', icon: 'vorlagen' },
        ]
      : [];
  const persoenlich: Punkt[] = [
    { zu: '/konto', text: 'Konto', icon: 'konto' },
    { zu: '/handbuch', text: 'Handbuch', icon: 'hilfe' },
    { zu: '/versionen', text: 'Versionshinweise', icon: 'versionen' },
  ];
  const inVerwaltung = verwaltung.some((p) => p.zu === pfad);
  const inMehr = inVerwaltung || persoenlich.some((p) => p.zu === pfad);
  const initialen = konto.anzeigename
    .split(/\s+/)
    .map((t) => t[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const logo = logoFuer(logos, dunkel);
  const schalte = (m: Menue) => setMenue((alt) => (alt === m ? null : m));

  const liste = (punkte: Punkt[]) =>
    punkte.map((p) => (
      <li key={p.zu}>
        <Link zu={p.zu} aktivAb={p.aktivAb}>
          <Icon name={p.icon} />
          {p.text}
        </Link>
      </li>
    ));
  const schalter = (
    <>
      {installation && (
        <li>
          <button
            type="button"
            onClick={() => {
              void installation.prompt();
              setInstallation(null);
              setMenue(null);
            }}
          >
            <Icon name="laden" />
            Als App installieren
          </button>
        </li>
      )}
      <li>
        <button type="button" onClick={() => void wechsleTheme()}>
          <Icon name={dunkel ? 'sonne' : 'mond'} />
          {dunkel ? 'Helle Darstellung' : 'Dunkle Darstellung'}
        </button>
      </li>
      <li>
        <button type="button" onClick={abmelden}>
          <Icon name="abmelden" />
          Abmelden
        </button>
      </li>
    </>
  );

  return (
    <>
      <a className="sprung" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className="leiste">
        <div className="leiste-innen">
          <Link zu={start} className="marke">
            {logo ? (
              <>
                <img src={logo} alt="Logo des Betriebs" className="logo" />
                <span className="marke-klein">Ausbildungsportal</span>
              </>
            ) : (
              <>
                <img src="/favicon.svg" alt="" width="28" height="28" />
                Ausbildungsportal
              </>
            )}
          </Link>
          <nav aria-label="Hauptnavigation" className="haupt-nav">
            {haupt.map((p) => (
              <Link key={p.zu} zu={p.zu} aktivAb={p.aktivAb}>
                {p.text}
              </Link>
            ))}
            {verwaltung.length > 0 && (
              <div className="menue">
                <button type="button" className={`menue-knopf${inVerwaltung ? ' aktiv' : ''}`} aria-expanded={menue === 'verwaltung'} aria-controls="menue-verwaltung" onClick={() => schalte('verwaltung')}>
                  Verwaltung
                  <Icon name="unten" groesse={16} />
                </button>
                {menue === 'verwaltung' && (
                  <ul id="menue-verwaltung" className="menue-flaeche">
                    {liste(verwaltung)}
                  </ul>
                )}
              </div>
            )}
          </nav>
          <div className="menue ich">
            <button type="button" className="menue-knopf" aria-expanded={menue === 'ich'} aria-controls="menue-ich" aria-label={`Menü für ${konto.anzeigename}`} onClick={() => schalte('ich')}>
              <span className="avatar" aria-hidden="true">
                {initialen}
              </span>
              <span className="ich-name">
                {konto.anzeigename}
                <small>{ROLLE_TEXT[konto.rolle]}</small>
              </span>
              <Icon name="unten" groesse={16} />
            </button>
            {menue === 'ich' && (
              <ul id="menue-ich" className="menue-flaeche rechts">
                {liste(persoenlich)}
                <li className="trenner" role="separator" />
                {schalter}
              </ul>
            )}
          </div>
        </div>
      </header>

      <main id="inhalt" tabIndex={-1}>
        {seite}
      </main>
      <footer className="fuss leise">
        Ausbildungsportal · Version {version}
        <span className="fuss-links">
          {' · '}
          <Link zu="/versionen">Versionshinweise</Link>
          {' · '}
          <Link zu="/handbuch">Handbuch</Link>
        </span>
      </footer>

      {/* Handy und Tablet: Leiste unten, die wichtigsten Bereiche mit dem Daumen erreichbar */}
      <nav aria-label="Hauptnavigation" className="tabs">
        {haupt.map((p) => (
          <Link key={p.zu} zu={p.zu} aktivAb={p.aktivAb}>
            <Icon name={p.icon} groesse={22} />
            <span>{p.kurz ?? p.text}</span>
          </Link>
        ))}
        <button type="button" className={inMehr ? 'aktiv' : undefined} aria-expanded={menue === 'mehr'} aria-controls="menue-mehr" onClick={() => schalte('mehr')}>
          <Icon name="mehr" groesse={22} />
          <span>Mehr</span>
        </button>
      </nav>
      {menue === 'mehr' && (
        <div className="bogen-hintergrund" onClick={() => setMenue(null)}>
          <div id="menue-mehr" className="bogen" role="dialog" aria-label="Weitere Bereiche" onClick={(e) => e.stopPropagation()}>
            <div className="bogen-kopf">
              <span className="avatar" aria-hidden="true">
                {initialen}
              </span>
              <span className="ich-name">
                {konto.anzeigename}
                <small>{ROLLE_TEXT[konto.rolle]}</small>
              </span>
              <button type="button" className="knopf schlicht symbol" aria-label="Menü schließen" onClick={() => setMenue(null)}>
                <Icon name="zu" />
              </button>
            </div>
            {verwaltung.length > 0 && (
              <>
                <span className="ueberschrift-klein">Verwaltung</span>
                <ul className="bogen-liste">{liste(verwaltung)}</ul>
              </>
            )}
            <span className="ueberschrift-klein">Persönlich</span>
            <ul className="bogen-liste">
              {liste(persoenlich)}
              {schalter}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
