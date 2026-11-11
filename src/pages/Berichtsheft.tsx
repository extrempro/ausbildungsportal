import { Ladefehler } from '../dialoge';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, berichtsheftPfad, datum, h, STATUS_FARBE, STATUS_TEXT, wocheText } from '../api';
import type { BerichtListe, BerichtStatus, Logos } from '../api';
import { Icon } from '../icons';
import { Link } from '../router';
import { BerichtBlatt, PdfKnopf } from './Bericht';
import { HandbuchLink } from '../handbuchLink';

/**
 * Merkt, ob der Azubi die Anleitung selbst auf- oder zugeklappt hat.
 * Neuer Name seit 0.9.3: Unter dem alten Namen hat Version 0.9.0 von sich aus „offen“ gespeichert – das hielt die Anleitung dauerhaft offen.
 */
const ANLEITUNG = 'berichtsheft-anleitung';

/** Was der Azubi mit einer Woche als Nächstes tun kann. */
const AKTION: Record<BerichtStatus, string> = { fehlt: 'Schreiben', entwurf: 'Weiterschreiben', zurueck: 'Überarbeiten', eingereicht: 'Ansehen', abgezeichnet: 'Ansehen' };

function Schritt({ nr, titel, children }: { nr: number; titel: string; children: ReactNode }) {
  return (
    <li>
      <span className="ablauf-nr">{nr}</span>
      <div>
        <strong>{titel}</strong>
        <div className="leise klein">{children}</div>
      </div>
    </li>
  );
}

const FILTER: { wert: BerichtStatus | 'alle'; text: string }[] = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'fehlt', text: 'Fehlt' },
  { wert: 'entwurf', text: 'Entwurf' },
  { wert: 'zurueck', text: 'Zurückgegeben' },
  { wert: 'eingereicht', text: 'Eingereicht' },
  { wert: 'abgezeichnet', text: 'Abgezeichnet' },
];

/** Liste aller Wochen der Ausbildung mit dem Stand des jeweiligen Berichts. */
function lies(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}
function merke(schluessel: string, wert: string): void {
  try {
    localStorage.setItem(schluessel, wert);
  } catch {
    // ohne Speicher bleibt die Anleitung einfach offen
  }
}

export function Berichtsheft({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState<BerichtStatus | 'alle'>('alle');
  const [hatUnterschrift, setHatUnterschrift] = useState(true);
  // Anleitung: von sich aus nur offen, solange noch kein Bericht geschrieben ist; danach eingeklappt.
  // Wer sie selbst auf- oder zuklappt, behält seine Wahl.
  const [anleitung, setAnleitung] = useState<boolean | null>(() => (lies(ANLEITUNG) === '1' ? true : lies(ANLEITUNG) === '0' ? false : null));

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte`).then(setDaten, (e: Error) => setFehler(e.message));
    api<{ pfad: string | null }>('GET', '/api/ich/unterschrift').then((r) => setHatUnterschrift(!!r.pfad), () => {});
  }, [azubiId]);

  if (fehler) {
    return (
      <>
        <h1>Berichtsheft nicht gefunden</h1>
        <p className="leise">{fehler}</p>
      </>
    );
  }
  if (!daten) return <p className="leise">Lädt …</p>;

  const basis = berichtsheftPfad(azubiId, daten.eigenes);
  const anleitungOffen = anleitung ?? daten.wochen.every((w) => w.status === 'fehlt');
  const anzahl = (s: BerichtStatus | 'alle') => (s === 'alle' ? daten.wochen.length : daten.wochen.filter((w) => w.status === s).length);
  const sichtbar = daten.wochen.filter((w) => filter === 'alle' || w.status === filter);

  return (
    <>
      {!daten.eigenes && (
        <p className="klein">
          <Link zu={`/azubis/${azubiId}`}>← {daten.azubi.anzeigename}</Link>
        </p>
      )}
      <h1>Berichtsheft{daten.eigenes ? '' : ` von ${daten.azubi.anzeigename}`}</h1>
      <p className="leise">
        {daten.eigenes
          ? 'Für jede Woche deiner Ausbildung schreibst du einen Bericht (Ausbildungsnachweis): Was hast du gemacht, und wie viele Stunden?'
          : 'Ein Bericht (Ausbildungsnachweis) je Kalenderwoche. Nur der Azubi selbst kann die Berichte bearbeiten.'}{' '}
        <HandbuchLink kapitel={daten.eigenes ? 'bericht' : 'abzeichnen'}>{daten.eigenes ? 'Einen Bericht schreiben' : 'Berichte lesen, abzeichnen, zurückgeben'}</HandbuchLink>
      </p>

      {daten.eigenes && !daten.beginnFehlt && (
        <section className={`karte anleitung${anleitungOffen ? '' : ' zu'}`}>
          <button
            type="button"
            className="anleitung-kopf"
            aria-expanded={anleitungOffen}
            aria-controls="anleitung-inhalt"
            onClick={() => {
              setAnleitung(!anleitungOffen);
              merke(ANLEITUNG, anleitungOffen ? '0' : '1');
            }}
          >
            <Icon name="hilfe" />
            <span className="anleitung-titel">So funktioniert das Berichtsheft</span>
            <span className="anleitung-schalter">
              {anleitungOffen ? 'Einklappen' : 'Anzeigen'}
            </span>
          </button>
          {anleitungOffen && (
            <div id="anleitung-inhalt">
              <ol className="ablauf-liste">
                <Schritt nr={1} titel="Woche öffnen und schreiben">
                  Wähle unten bei der Woche „Schreiben“. Trag ein, was du gemacht hast, und die Stunden dazu.
                </Schritt>
                <Schritt nr={2} titel="Speichern oder einreichen">
                  Noch nicht fertig? „Als Entwurf speichern“ – du schreibst später weiter. Fertig? „Einreichen“ – damit gibst du den Bericht ab.
                </Schritt>
                <Schritt nr={3} titel="Dein Ausbilder zeichnet ab">
                  Er liest den Bericht und unterschreibt. Möchte er eine Änderung, bekommst du den Bericht zurück – dann steht hier „zurückgegeben“.
                </Schritt>
              </ol>
              <p className="leise klein">
                Tipp: Schreib den Bericht am Ende jeder Woche. Mehr dazu im <Link zu="/handbuch">Handbuch</Link>.
              </p>
            </div>
          )}
        </section>
      )}
      {daten.eigenes && !hatUnterschrift && (
        <p className="hinweis">
          Bevor du einen Bericht einreichen kannst, brauchst du eine Unterschrift. <Link zu="/konto">Jetzt unter „Konto“ unterschreiben</Link>
        </p>
      )}

      {daten.beginnFehlt ? (
        <p className="hinweis">
          {daten.eigenes ? 'Für dich ist noch kein Ausbildungsbeginn eingetragen. Bitte wende dich an deinen Ausbilder – erst dann lassen sich Berichte schreiben.' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil.'}
        </p>
      ) : (
        <>
          <div className="filter" role="group" aria-label="Nach Stand filtern">
            {FILTER.filter((f) => f.wert === 'alle' || anzahl(f.wert) > 0).map((f) => (
              <button key={f.wert} type="button" className="knopf schlicht" aria-pressed={filter === f.wert} onClick={() => setFilter(f.wert)}>
                {f.text} ({anzahl(f.wert)})
              </button>
            ))}
            {anzahl('alle') > anzahl('fehlt') && (
              <span className="heft-pdf rechts">
                {/* Abkürzung: das ganze Heft sofort als PDF – ohne die Seite mit der Auswahl */}
                <PdfKnopf
                  symbol
                  pfad={`/api/azubis/${azubiId}/berichtsheft.pdf?nur=abgezeichnet`}
                  text="Berichtsheft sofort als PDF herunterladen (alle abgezeichneten Berichte)"
                  gesperrt={anzahl('abgezeichnet') === 0 ? 'Es ist noch kein Bericht abgezeichnet.' : undefined}
                />
                <Link zu={`${basis}/druck`} className="knopf">
                  <Icon name="heft" /> Berichtsheft drucken …
                </Link>
              </span>
            )}
          </div>
          <div className="karte tabelle-rahmen">
            <table className="stapel">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Zeitraum</th>
                  <th>Stand</th>
                  <th className="zahl">Stunden</th>
                  <th>
                    <span className="nur-vorleser">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((w) => (
                  <tr key={w.montag}>
                    <td className="eng kopf">
                      <Link zu={`${basis}/${w.montag}`}>
                        <strong>
                          KW {w.kw}/{w.jahr}
                        </strong>
                      </Link>
                    </td>
                    <td className="eng" data-label="Zeitraum">
                      <span>
                        {wocheText(w.montag, w.sonntag)}
                        {w.ausbildungsjahr ? <span className="leise"> · {w.ausbildungsjahr}. Jahr</span> : null}
                      </span>
                    </td>
                    <td data-label="Stand">
                      <span className={`pille ${STATUS_FARBE[w.status]}`}>{STATUS_TEXT[w.status]}</span>
                    </td>
                    <td className="zahl" data-label="Stunden">{w.status === 'fehlt' ? '–' : `${h(w.stunden)} von ${h(daten.soll)}`}</td>
                    <td className="aktion">
                      <Link zu={`${basis}/${w.montag}`} className={`knopf klein${daten.eigenes && (w.status === 'fehlt' || w.status === 'zurueck' || w.status === 'entwurf') ? '' : ' schlicht'}`}>
                        {daten.eigenes ? AKTION[w.status] : 'Ansehen'}
                        <span className="nur-vorleser">
                          , KW {w.kw}/{w.jahr}
                        </span>
                      </Link>
                      {w.status !== 'fehlt' && <PdfKnopf symbol klasse="knopf schlicht klein" pfad={`/api/azubis/${azubiId}/berichtsheft.pdf?woche=${w.montag}`} text={`Bericht KW ${w.kw}/${w.jahr} als PDF herunterladen`} />}
                      {w.status !== 'fehlt' && (
                        <Link zu={`${basis}/${w.montag}?drucken`} className="knopf schlicht klein">
                          Drucken
                          <span className="nur-vorleser">
                            , KW {w.kw}/{w.jahr}
                          </span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {sichtbar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="leise">
                      Keine Wochen mit diesem Stand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Logo des Betriebs (helle Fassung) für das Deckblatt. */
function useLogo(): string | null {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    api<Logos>('GET', '/api/branding').then((l) => setLogo(l.logo), () => {});
  }, []);
  return logo;
}

/**
 * Das Berichtsheft als eine Datei: Deckblatt und alle gewählten Berichte, jede Woche auf einer eigenen Seite.
 * Gespeichert wird über das Druckfenster des Browsers („Als PDF speichern“) – oder gedruckt.
 */
export function BerichteDruck({ azubiId }: { azubiId: number }) {
  const [daten, setDaten] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  // Vorgabe: nur, was abgezeichnet ist – das ist das Heft, das man aus der Hand gibt
  const [nur, setNur] = useState<'alle' | 'abgezeichnet'>('abgezeichnet');
  const [jahr, setJahr] = useState(0); // 0 = alle Ausbildungsjahre
  const [deckblatt, setDeckblatt] = useState(true);
  const logo = useLogo();

  useEffect(() => {
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte?voll=1`).then(setDaten, (e: Error) => setFehler(e.message));
  }, [azubiId]);

  if (fehler) return <Ladefehler titel="Berichtsheft" text={fehler} />;
  if (!daten) return <p className="leise">Lädt …</p>;
  const alle = [...(daten.berichte ?? [])].sort((a, b) => a.montag.localeCompare(b.montag));
  const jahre = [...new Set(alle.map((b) => b.ausbildungsjahr).filter((j): j is number => !!j))].sort();
  const berichte = alle.filter((b) => (nur === 'alle' || b.status === 'abgezeichnet') && (jahr === 0 || b.ausbildungsjahr === jahr));
  const erster = berichte[0];
  const letzter = berichte[berichte.length - 1];
  const zeitraum = erster ? `${datum(erster.montag)} bis ${datum(letzter.sonntag)}` : '';
  const abgezeichnet = berichte.filter((b) => b.status === 'abgezeichnet').length;
  const keine = berichte.length === 0;

  /** Der Browser schlägt den Seitentitel als Dateinamen vor – deshalb heißt die Seite beim Drucken wie das Heft. */
  const drucke = () => {
    const vorher = document.title;
    document.title = `Berichtsheft ${daten.azubi.anzeigename}${erster ? ` ${erster.montag} bis ${letzter.sonntag}` : ''}`;
    window.addEventListener('afterprint', () => (document.title = vorher), { once: true });
    window.print();
  };

  return (
    <>
      <div className="nicht-drucken">
        <p className="klein">
          <Link zu={berichtsheftPfad(azubiId, daten.eigenes)}>← Berichtsheft</Link>
        </p>
        <h1>Berichtsheft drucken oder als PDF herunterladen</h1>
        <p className="leise">
          {daten.azubi.anzeigename} · Aus den gewählten Berichten wird ein Dokument: {deckblatt ? 'ein Deckblatt, dann ' : ''}jede Woche auf einer eigenen Seite. Einen einzelnen Bericht bekommst du auf der Seite des Berichts über „Als PDF herunterladen“.
        </p>
        <section className="karte heft-auswahl" aria-label="Auswahl für das Dokument">
          <div className="filter" role="group" aria-label="Welche Berichte">
            <button type="button" className="knopf schlicht" aria-pressed={nur === 'abgezeichnet'} onClick={() => setNur('abgezeichnet')}>
              Nur abgezeichnete ({alle.filter((b) => b.status === 'abgezeichnet').length})
            </button>
            <button type="button" className="knopf schlicht" aria-pressed={nur === 'alle'} onClick={() => setNur('alle')}>
              Auch nicht abgezeichnete ({alle.length})
            </button>
          </div>
          {jahre.length > 1 && (
            <div className="filter" role="group" aria-label="Welches Ausbildungsjahr">
              <button type="button" className="knopf schlicht" aria-pressed={jahr === 0} onClick={() => setJahr(0)}>
                Alle Ausbildungsjahre
              </button>
              {jahre.map((j) => (
                <button key={j} type="button" className="knopf schlicht" aria-pressed={jahr === j} onClick={() => setJahr(j)}>
                  {j}. Ausbildungsjahr
                </button>
              ))}
            </div>
          )}
          <label className="haken">
            <input type="checkbox" checked={deckblatt} onChange={(e) => setDeckblatt(e.target.checked)} /> Mit Deckblatt
          </label>
          <p role="status" aria-live="polite">
            <strong>{berichte.length === 1 ? '1 Bericht' : `${berichte.length} Berichte`}</strong>
            {zeitraum && ` · ${zeitraum}`}
            {berichte.length > abgezeichnet && ` · ${abgezeichnet} abgezeichnet, ${berichte.length - abgezeichnet} nicht abgezeichnet`}
          </p>
          {nur === 'alle' && berichte.length > abgezeichnet && <p className="hinweis">Nicht abgezeichnete Berichte tragen quer über die Seite den Vermerk „Entwurf“ bzw. „Nicht abgezeichnet“ – so kann sie niemand für fertige Nachweise halten.</p>}
          {keine && <p className="hinweis">{nur === 'abgezeichnet' && alle.length > 0 ? 'Es ist noch kein Bericht abgezeichnet. Zum Durchsehen kannst du oben „Auch nicht abgezeichnete“ wählen.' : 'In dieser Auswahl gibt es keine Berichte.'}</p>}
          <div className="aktionen links">
            <button type="button" className="knopf" onClick={drucke} disabled={keine}>
              Berichtsheft drucken
            </button>
            <PdfKnopf
              text="PDF herunterladen"
              pfad={`/api/azubis/${azubiId}/berichtsheft.pdf?${[nur === 'abgezeichnet' ? 'nur=abgezeichnet' : '', jahr ? `jahr=${jahr}` : '', deckblatt ? '' : 'deckblatt=0'].filter(Boolean).join('&')}`}
              gesperrt={keine ? 'Keine Berichte in dieser Auswahl.' : undefined}
            />
          </div>
          <p className="leise klein">
            „Berichtsheft drucken“ öffnet das Druckfenster. „PDF herunterladen“ erzeugt die Datei direkt. Die Vorschau darunter zeigt, was hineinkommt. <HandbuchLink kapitel="drucken">Berichtsheft drucken oder als PDF herunterladen</HandbuchLink>
          </p>
        </section>
      </div>
      {deckblatt && erster && (
        <section className="karte druckseite">
          <article className="blatt deckblatt">
            {logo && <img src={logo} alt="" className="deckblatt-logo" />}
            <p className="deckblatt-art">Ausbildungsnachweis</p>
            <h2>Berichtsheft</h2>
            <p className="deckblatt-name">{erster.kopf.azubi || daten.azubi.anzeigename}</p>
            <dl>
              {erster.kopf.beruf && (
                <div>
                  <dt>Ausbildungsberuf</dt>
                  <dd>{erster.kopf.beruf}</dd>
                </div>
              )}
              {erster.kopf.betrieb && (
                <div>
                  <dt>Ausbildungsbetrieb</dt>
                  <dd>{erster.kopf.betrieb}</dd>
                </div>
              )}
              {letzter.kopf.ausbilder && (
                <div>
                  <dt>Ausbilder/in</dt>
                  <dd>{letzter.kopf.ausbilder}</dd>
                </div>
              )}
              <div>
                <dt>Zeitraum</dt>
                <dd>
                  {zeitraum}
                  {jahr > 0 && ` (${jahr}. Ausbildungsjahr)`}
                </dd>
              </div>
              <div>
                <dt>Inhalt</dt>
                <dd>
                  {berichte.length === 1 ? '1 Wochenbericht' : `${berichte.length} Wochenberichte`}
                  {abgezeichnet === berichte.length ? (berichte.length === 1 ? ', abgezeichnet' : ', alle abgezeichnet') : `: ${abgezeichnet} abgezeichnet, ${berichte.length - abgezeichnet} nicht abgezeichnet (als solche gekennzeichnet)`}
                </dd>
              </div>
            </dl>
            <p className="leise klein deckblatt-fuss">Erstellt am {datum(new Date().toISOString().slice(0, 10))} im Ausbildungsportal</p>
          </article>
        </section>
      )}
      {berichte.map((b) => (
        <section className="karte druckseite" key={b.montag}>
          <BerichtBlatt b={b} />
        </section>
      ))}

    </>
  );
}
