import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiFehler, ladeDatei, ladeHoch, zeit } from '../api';
import { melde, rueckfrage } from '../dialoge';
import { HandbuchLink } from '../handbuchLink';
import { useUngespeichert } from '../router';

/**
 * Lerninhalte einreichen (Ausbilder) und prüfen (Super-Admin).
 * Ein Inhaltspaket kommt als ZIP-Datei. Das Portal prüft es sofort; der Super-Admin gibt es zurück oder übernimmt es.
 */
export interface Pruefung {
  titel: string;
  stand: string;
  themenfelder: number;
  unterthemen: number;
  dateien: number;
  fehler: string[];
  warnungen: string[];
  ignoriert: string[];
}
export interface Einreichung {
  id: number;
  kennung: string;
  titel: string;
  ausbilder: string;
  eigene: boolean;
  notiz: string;
  groesse: number;
  pruefung: Pruefung;
  status: 'eingereicht' | 'zurueck' | 'hochgeladen' | 'zurueckgezogen';
  rueckmeldung: string;
  geprueftVon: string;
  geprueftAm: string | null;
  erstellt: string;
  ersetzt: boolean;
  rechte: { zurueckziehen: boolean; entscheiden: boolean; laden: boolean };
}

const STATUS: Record<Einreichung['status'], { text: string; farbe: string }> = {
  eingereicht: { text: 'Eingereicht – wird geprüft', farbe: 'gelb' },
  zurueck: { text: 'Zurückgegeben', farbe: 'rot' },
  hochgeladen: { text: 'Hochgeladen', farbe: 'gruen' },
  zurueckgezogen: { text: 'Zurückgezogen', farbe: 'grau' },
};
const groesse = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

function Liste({ titel, zeilen }: { titel: string; zeilen: string[] }) {
  if (zeilen.length === 0) return null;
  return (
    <details className="klapp">
      <summary>
        {titel} ({zeilen.length})
      </summary>
      <ul className="einr-meldungen">
        {zeilen.map((z, i) => (
          <li key={i}>{z}</li>
        ))}
      </ul>
    </details>
  );
}

export function EinreichungKarte({ e, onGeaendert }: { e: Einreichung; onGeaendert: () => Promise<void> | void }) {
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  // Zurückgeben braucht eine Rückmeldung, Übernehmen erlaubt einen Kommentar – das Feld erscheint an Ort und Stelle
  const [fuer, setFuer] = useState<'zurueckgeben' | 'uebernehmen' | null>(null);
  const [text, setText] = useState('');
  useUngespeichert(fuer !== null && text.trim() !== '');
  const s = STATUS[e.status];

  const sende = async (aktion: string, body: unknown, fertig: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', `/api/lernpakete/einreichungen/${e.id}/${aktion}`, body);
      setFuer(null);
      setText('');
      melde(fertig);
      await onGeaendert();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLaeuft(false);
    }
  };
  const entscheide = async (ev: FormEvent) => {
    ev.preventDefault();
    if (fuer === 'zurueckgeben') return sende('zurueckgeben', { rueckmeldung: text }, 'Einreichung zurückgegeben.');
    const frage = e.ersetzt
      ? `Lerninhalte „${e.kennung}“ hochladen und das vorhandene Lernmodul ersetzen?\n\nDie neuen Inhalte gelten sofort für alle Azubis, deren Beruf dieses Lernmodul nutzt. Ihr Lernstand bleibt erhalten.`
      : `Lerninhalte „${e.kennung}“ hochladen?\n\nDas Lernmodul steht danach in den Stammdaten zur Auswahl. Azubis sehen es erst, wenn ein Ausbilder es an einem Beruf einschaltet.`;
    if (await rueckfrage(frage, { ja: 'Lerninhalte hochladen' })) await sende('uebernehmen', { kommentar: text }, 'Lerninhalte hochgeladen.');
  };
  const zieheZurueck = async () => {
    if (await rueckfrage(`Einreichung „${e.kennung}“ zurückziehen?\n\nDie hochgeladene ZIP-Datei wird gelöscht. Du kannst jederzeit neu einreichen.`, { ja: 'Einreichung zurückziehen', gefahr: true })) await sende('zurueckziehen', {}, 'Einreichung zurückgezogen.');
  };
  const lade = async () => {
    setFehler('');
    try {
      await ladeDatei(`/api/lernpakete/einreichungen/${e.id}/zip`);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const p = e.pruefung;
  return (
    <li className="karte antrag">
      <div className="antrag-kopf">
        <h3>
          {e.titel || e.kennung} <code>{e.kennung}</code>
        </h3>
        <span className={`pille ${s.farbe}`}>{s.text}</span>
      </div>
      <p className="antrag-zeile">
        <strong>
          {p.themenfelder} {p.themenfelder === 1 ? 'Themenfeld' : 'Themenfelder'}, {p.unterthemen} Unterthemen
        </strong>
        <span className="leise">
          {' '}
          · {p.dateien} Dateien, {groesse(e.groesse)} · eingereicht von {e.ausbilder} am {zeit(e.erstellt)}
          {p.stand ? ` · Inhaltsstand ${p.stand.slice(8, 10)}.${p.stand.slice(5, 7)}.${p.stand.slice(0, 4)}` : ''}
        </span>
      </p>
      {e.notiz && <p className="antrag-bemerkung">„{e.notiz}“</p>}
      {e.status === 'eingereicht' && e.ersetzt && (
        <p className="hinweis" role="note">
          Es gibt schon ein Lernmodul mit der Kennung „{e.kennung}“. Beim Hochladen wird es durch diese Fassung ersetzt.
        </p>
      )}
      {(e.status === 'zurueck' || e.status === 'hochgeladen') && (
        <p className={`hinweis${e.status === 'hochgeladen' ? ' gut' : ''}`} role="note">
          <strong>
            {e.status === 'zurueck' ? 'Zurückgegeben' : 'Hochgeladen'} von {e.geprueftVon} am {zeit(e.geprueftAm)}
            {e.rueckmeldung ? ':' : '.'}
          </strong>{' '}
          {e.rueckmeldung}
        </p>
      )}
      <Liste titel="Hinweise der automatischen Prüfung" zeilen={p.warnungen} />
      <Liste titel="Nicht übernommene Dateien" zeilen={p.ignoriert} />

      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {fuer ? (
        <form onSubmit={(ev) => void entscheide(ev)} className="antrag-grund">
          <label>
            {fuer === 'zurueckgeben' ? 'Was soll geändert werden?' : 'Kommentar (freiwillig)'}
            <textarea value={text} onChange={(ev) => setText(ev.target.value)} maxLength={2000} rows={3} required={fuer === 'zurueckgeben'} autoFocus />
          </label>
          <p className="leise klein">{e.ausbilder} liest diesen Text bei der Einreichung.</p>
          <p className="aktionen links">
            <button className={`knopf${fuer === 'zurueckgeben' ? ' rot' : ''}`} disabled={laeuft || (fuer === 'zurueckgeben' && text.trim() === '')}>
              {fuer === 'zurueckgeben' ? 'Einreichung zurückgeben' : 'Lerninhalte hochladen'}
            </button>
            <button
              type="button"
              className="knopf schlicht"
              onClick={() => {
                setFuer(null);
                setText('');
              }}
            >
              Abbrechen
            </button>
          </p>
        </form>
      ) : (
        (e.rechte.entscheiden || e.rechte.laden || e.rechte.zurueckziehen) && (
          <p className="aktionen links">
            {e.rechte.entscheiden && (
              <button type="button" className="knopf" disabled={laeuft} onClick={() => setFuer('uebernehmen')}>
                Lerninhalte hochladen …
              </button>
            )}
            {e.rechte.entscheiden && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => setFuer('zurueckgeben')}>
                Einreichung zurückgeben …
              </button>
            )}
            {e.rechte.laden && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void lade()}>
                ZIP-Datei herunterladen
              </button>
            )}
            {e.rechte.zurueckziehen && (
              <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void zieheZurueck()}>
                Einreichung zurückziehen
              </button>
            )}
          </p>
        )
      )}
    </li>
  );
}

/** Formular des Ausbilders: Kennung, ZIP-Datei, Notiz. Fehler des Inhaltspakets stehen direkt darunter. */
export function EinreichenFormular({ maxMb, onEingereicht }: { maxMb: number; onEingereicht: () => Promise<void> | void }) {
  const [kennung, setKennung] = useState('');
  const [notiz, setNotiz] = useState('');
  const [datei, setDatei] = useState<File | null>(null);
  const [nr, setNr] = useState(0);
  const [fehler, setFehler] = useState('');
  const [liste, setListe] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert(kennung !== '' || notiz !== '' || datei !== null);
  const zuGross = datei !== null && datei.size > maxMb * 1024 * 1024;

  const sende = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!datei) return;
    setLaeuft(true);
    setFehler('');
    setListe([]);
    try {
      await ladeHoch(`/api/lernpakete/einreichungen?kennung=${encodeURIComponent(kennung)}&notiz=${encodeURIComponent(notiz)}`, datei, 'application/zip');
      setKennung('');
      setNotiz('');
      setDatei(null);
      setNr((n) => n + 1); // leert das Dateifeld
      melde('Lerninhalte eingereicht. Der Betreiber des Portals prüft sie.');
      await onEingereicht();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
      const p = err instanceof ApiFehler ? (err.daten.pruefung as Pruefung | undefined) : undefined;
      setListe(p?.fehler ?? []);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className="karte">
      <h2>Lerninhalte einreichen</h2>
      <p className="leise">
        Lade ein Inhaltspaket als ZIP-Datei hoch. Das Portal prüft es sofort, danach sieht es der Betreiber des Portals und lädt es hoch oder gibt es mit einer Rückmeldung zurück.{' '}
        <HandbuchLink kapitel="lerninhalte">Lerninhalte für einen Beruf erstellen</HandbuchLink>
      </p>
      <form onSubmit={(ev) => void sende(ev)}>
        <div className="reihe">
          <label>
            Kennung des Lernmoduls
            <input value={kennung} onChange={(ev) => setKennung(ev.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9\-]{0,30}" maxLength={31} required placeholder="z. B. kaufleute-buero" autoComplete="off" />
          </label>
          <label>
            ZIP-Datei (höchstens {maxMb} MB)
            <input key={nr} type="file" accept=".zip,application/zip" required onChange={(ev) => setDatei(ev.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="leise klein">Die Kennung ist der Ordnername: Kleinbuchstaben, Ziffern, Bindestriche. Gibt es das Lernmodul schon, nimm dieselbe Kennung – die neue Fassung ersetzt dann die alte.</p>
        <label>
          Notiz für die Prüfung (freiwillig)
          <input value={notiz} onChange={(ev) => setNotiz(ev.target.value)} maxLength={500} placeholder="z. B. Themenfeld Buchführung ergänzt" />
        </label>
        {zuGross && (
          <p className="hinweis fehler" role="alert">
            Die Datei ist größer als {maxMb} MB.
          </p>
        )}
        {fehler && (
          <div className="hinweis fehler" role="alert">
            <p>{fehler}</p>
            {liste.length > 0 && (
              <ul className="einr-meldungen">
                {liste.slice(0, 30).map((z, i) => (
                  <li key={i}>{z}</li>
                ))}
                {liste.length > 30 && <li>… und {liste.length - 30} weitere</li>}
              </ul>
            )}
          </div>
        )}
        <p className="aktionen links">
          <button className="knopf" disabled={laeuft || zuGross}>
            {laeuft ? 'Wird hochgeladen und geprüft …' : 'Lerninhalte einreichen'}
          </button>
        </p>
      </form>
    </section>
  );
}
