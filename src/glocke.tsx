import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import type { Konto } from './api';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Link } from './router';

/**
 * Glocke in der Kopfzeile: neue Einträge im Ausbildungsplan und Schritte im Berichtsheft.
 * Der Server fasst zusammen, was zusammengehört (gleiche Person, gleicher Azubi, gleiche Art, gleicher Tag).
 */
type Art = 'plan_neu' | 'bericht_eingereicht' | 'bericht_abgezeichnet' | 'bericht_zurueck' | 'bericht_geoeffnet';

interface Gruppe {
  id: number;
  art: Art;
  zeit: string;
  azubiId: number;
  azubiName: string;
  akteurName: string;
  anzahl: number;
  titel: string[];
  wochen: string[];
  neu: boolean;
}

interface Antwort {
  neu: number;
  bis: number;
  gruppen: Gruppe[];
}

const ABFRAGE_MS = 90_000;

/** Kalenderwoche nach ISO 8601 zu einem Montag (JJJJ-MM-TT) */
function kw(montag: string): number {
  const d = new Date(`${montag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3); // der Donnerstag bestimmt das Jahr der Woche
  const ersterJanuar = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - ersterJanuar) / 86_400_000 / 7) + 1;
}

function aufzaehlung(teile: string[], weitere = 0): string {
  if (weitere > 0) return `${teile.join(', ')} und ${weitere} weitere`;
  if (teile.length < 2) return teile.join('');
  return `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}`;
}

function wochenText(wochen: string[]): string {
  if (wochen.length === 0) return '';
  const gezeigt = wochen.slice(0, 4).map((m) => String(kw(m)));
  return `KW ${aufzaehlung(gezeigt, wochen.length - gezeigt.length)}`;
}

function wann(iso: string): string {
  const d = new Date(iso);
  const minuten = Math.round((Date.now() - d.getTime()) / 60_000);
  if (minuten < 2) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min.`;
  if (minuten < 24 * 60 && d.getDate() === new Date().getDate()) return `vor ${Math.round(minuten / 60)} Std.`;
  const gestern = new Date();
  gestern.setDate(gestern.getDate() - 1);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === gestern.toDateString()) return `gestern, ${uhr} Uhr`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Zeile {
  icon: IconName;
  farbe: string;
  kopf: string;
  mitte: string;
  zu: string;
}

function beschreibe(g: Gruppe, konto: Konto): Zeile {
  const azubi = konto.rolle === 'azubi';
  const n = g.anzahl;
  const heft = azubi ? '/berichtsheft' : `/azubis/${g.azubiId}/berichtsheft`;
  const bericht = g.wochen.length === 1 ? `${heft}/${g.wochen[0]}` : heft;
  switch (g.art) {
    case 'plan_neu':
      return {
        icon: 'plan',
        farbe: 'blau',
        kopf: n === 1 ? 'Neuer Eintrag im Ausbildungsplan' : `${n} neue Einträge im Ausbildungsplan`,
        mitte: aufzaehlung(g.titel, g.titel.some((t) => t.startsWith('Baustein ') || t.startsWith('Vorlage ')) ? 0 : Math.max(0, n - g.titel.length)),
        zu: azubi ? '/' : `/azubis/${g.azubiId}/plan`,
      };
    case 'bericht_eingereicht':
      return { icon: 'heft', farbe: 'gelb', kopf: n === 1 ? 'Bericht wartet auf Abzeichnung' : `${n} Berichte warten auf Abzeichnung`, mitte: wochenText(g.wochen), zu: '/abzeichnen' };
    case 'bericht_abgezeichnet':
      return { icon: 'abzeichnen', farbe: 'gruen', kopf: n === 1 ? 'Bericht abgezeichnet' : `${n} Berichte abgezeichnet`, mitte: wochenText(g.wochen), zu: bericht };
    case 'bericht_zurueck':
      return {
        icon: 'heft',
        farbe: 'rot',
        kopf: (n === 1 ? 'Bericht zurückgegeben' : `${n} Berichte zurückgegeben`) + (azubi ? ' – bitte überarbeiten' : ''),
        mitte: wochenText(g.wochen),
        zu: bericht,
      };
    default:
      return { icon: 'heft', farbe: 'rot', kopf: n === 1 ? 'Abzeichnung aufgehoben' : `${n} Abzeichnungen aufgehoben`, mitte: wochenText(g.wochen), zu: bericht };
  }
}

export function Glocke({ konto, pfad, offen, onSchalte }: { konto: Konto; pfad: string; offen: boolean; onSchalte: () => void }) {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState(false);
  // die Liste, wie sie beim Öffnen aussah – „neu“ bleibt markiert, bis die Glocke wieder zu ist
  const [gezeigt, setGezeigt] = useState<Gruppe[] | null>(null);
  const warOffen = useRef(false);

  const lade = useCallback(async () => {
    try {
      setDaten(await api<Antwort>('GET', '/api/aktivitaeten'));
      setFehler(false);
    } catch {
      setFehler(true);
    }
  }, []);

  // beim Start, bei jedem Seitenwechsel, regelmäßig und wenn man zum Fenster zurückkehrt
  useEffect(() => {
    void lade();
  }, [lade, pfad]);
  useEffect(() => {
    const takt = window.setInterval(() => document.visibilityState === 'visible' && void lade(), ABFRAGE_MS);
    const sichtbar = () => document.visibilityState === 'visible' && void lade();
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [lade]);

  // Öffnen heißt gesehen: Die Zahl verschwindet, die Markierung bleibt bis zum Schließen stehen
  useEffect(() => {
    if (offen && !warOffen.current) {
      warOffen.current = true;
      void (async () => {
        try {
          const frisch = await api<Antwort>('GET', '/api/aktivitaeten');
          setGezeigt(frisch.gruppen);
          setFehler(false);
          setDaten(frisch.neu > 0 ? await api<Antwort>('POST', '/api/aktivitaeten/gesehen', { bis: frisch.bis }) : frisch);
        } catch {
          setFehler(true);
        }
      })();
    } else if (!offen && warOffen.current) {
      warOffen.current = false;
      setGezeigt(null);
    }
  }, [offen]);

  const neu = daten?.neu ?? 0;
  const liste = gezeigt ?? daten?.gruppen ?? [];
  const zahl = neu > 99 ? '99+' : String(neu);

  return (
    <div className="menue glocke">
      <button
        type="button"
        className="menue-knopf glocke-knopf"
        aria-expanded={offen}
        aria-controls="menue-glocke"
        aria-label={neu > 0 ? `Aktivitäten, ${neu} neu` : 'Aktivitäten, nichts Neues'}
        title="Aktivitäten"
        onClick={onSchalte}
      >
        <Icon name="glocke" groesse={22} />
        {neu > 0 && (
          <span className="glocke-zahl" aria-hidden="true">
            {zahl}
          </span>
        )}
      </button>
      {/* dunkelt die Seite ab, damit sich das Fenster klar abhebt; liegt unter der Kopfzeile */}
      {offen && createPortal(<div className="glocke-schleier" aria-hidden="true" />, document.body)}
      {offen && (
        <section id="menue-glocke" className="menue-flaeche rechts glocke-flaeche" aria-label="Aktivitäten">
          <div className="glocke-kopf">
            <span className="glocke-kopf-symbol" aria-hidden="true">
              <Icon name="glocke" groesse={20} />
            </span>
            <div>
              <h2>Aktivitäten</h2>
              <span>{konto.rolle === 'azubi' ? 'Neues in deinem Plan und Berichtsheft' : 'Neues von deinen Azubis'}</span>
            </div>
            <button type="button" className="glocke-zu" aria-label="Aktivitäten schließen" onClick={onSchalte}>
              <Icon name="zu" groesse={20} />
            </button>
          </div>
          {fehler && <p className="glocke-leer">Die Aktivitäten lassen sich gerade nicht laden.</p>}
          {!fehler && gezeigt === null && <p className="glocke-leer">Lädt …</p>}
          {!fehler && gezeigt !== null && liste.length === 0 && (
            <p className="glocke-leer">
              Noch nichts Neues.
              <br />
              <span className="klein">Hier steht, wenn jemand etwas in den Ausbildungsplan einträgt oder sich bei einem Bericht etwas tut.</span>
            </p>
          )}
          {!fehler && gezeigt !== null && liste.length > 0 && (
            <ul className="glocke-liste">
              {liste.map((g) => {
                const z = beschreibe(g, konto);
                const wer = g.art === 'bericht_eingereicht' ? g.azubiName : `von ${g.akteurName}`;
                const fuer = konto.rolle !== 'azubi' && g.art !== 'bericht_eingereicht' && g.akteurName !== g.azubiName ? ` · für ${g.azubiName}` : '';
                return (
                  <li key={g.id} className={g.neu ? 'neu' : undefined}>
                    <Link zu={z.zu}>
                      <span className={`glocke-symbol ${z.farbe}`} aria-hidden="true">
                        <Icon name={z.icon} groesse={18} />
                      </span>
                      <span className="glocke-text">
                        <strong>
                          {z.kopf}
                          {g.neu && <span className="nur-vorleser"> (neu)</span>}
                        </strong>
                        {z.mitte && <span className="glocke-mitte">{z.mitte}</span>}
                        <small>
                          {wer}
                          {fuer} · {wann(g.zeit)}
                        </small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="glocke-fuss leise klein">Gleiche Aktivitäten eines Tages sind zusammengefasst. Nach 60 Tagen werden sie gelöscht.</p>
        </section>
      )}
    </div>
  );
}
