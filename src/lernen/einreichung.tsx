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
  /** Titel des Planers für die Prüfung (planer.md); leer oder fehlend = das Paket hat keinen */
  planer?: string;
  /** Folgen für vorhandene Daten, die beim Einreichen bestätigt wurden */
  achtung?: string[];
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

/** Eine Einreichung als eigene Karte – so sieht sie der Super-Admin, solange sie auf die Prüfung wartet. */
export function EinreichungKarte({ e, onGeaendert }: { e: Einreichung; onGeaendert: () => Promise<void> | void }) {
  const s = STATUS[e.status];
  return (
    <li className="karte antrag">
      <div className="antrag-kopf">
        <h3>
          {e.titel || e.kennung} <code>{e.kennung}</code>
        </h3>
        <span className={`pille ${s.farbe}`}>{s.text}</span>
      </div>
      <EinreichungTeil e={e} onGeaendert={onGeaendert} />
    </li>
  );
}

/** Was zu einer Einreichung gehört: Umfang, Notiz, Rückmeldung, Hinweise der Prüfung und die Knöpfe – ohne Rahmen und Überschrift. */
export function EinreichungTeil({ e, onGeaendert }: { e: Einreichung; onGeaendert: () => Promise<void> | void }) {
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  // Zurückgeben braucht eine Rückmeldung, Übernehmen erlaubt einen Kommentar – das Feld erscheint an Ort und Stelle
  const [fuer, setFuer] = useState<'zurueckgeben' | 'uebernehmen' | null>(null);
  const [text, setText] = useState('');
  useUngespeichert(fuer !== null && text.trim() !== '');

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
    <>
      <p className="antrag-zeile">
        <strong>
          {p.themenfelder} {p.themenfelder === 1 ? 'Themenfeld' : 'Themenfelder'}, {p.unterthemen} Unterthemen
          {p.planer ? `, Planer: ${p.planer}` : ''}
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
      {(p.achtung ?? []).length > 0 && (
        <div className="hinweis">
          <p>
            <strong>Folgen für vorhandene Daten</strong> – beim Einreichen bestätigt:
          </p>
          <ul className="einr-meldungen">
            {(p.achtung ?? []).map((z, i) => (
              <li key={i}>{z}</li>
            ))}
          </ul>
        </div>
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
    </>
  );
}

/**
 * Verlauf: was mit den Einreichungen geschah, das Neueste oben – eine Zeile je Ereignis.
 * Eine zurückgezogene Einreichung hat keinen eigenen Zeitpunkt; das steht an der Zeile des Einreichens.
 */
export function EinreichungVerlauf({ einreichungen }: { einreichungen: Einreichung[] }) {
  const zeilen = einreichungen
    .flatMap((e) => {
      const name = `„${e.titel || e.kennung}“`;
      const out: { id: string; wann: string; farbe: string; was: string; text: string; zusatz: string }[] = [
        { id: `${e.id}-e`, wann: e.erstellt, farbe: 'gelb', was: 'Eingereicht', text: `${name} von ${e.ausbilder}${e.status === 'zurueckgezogen' ? ' – später zurückgezogen' : ''}`, zusatz: e.notiz },
      ];
      if ((e.status === 'zurueck' || e.status === 'hochgeladen') && e.geprueftAm) {
        out.push({ id: `${e.id}-p`, wann: e.geprueftAm, farbe: STATUS[e.status].farbe, was: STATUS[e.status].text, text: `${name} von ${e.geprueftVon}`, zusatz: e.rueckmeldung });
      }
      return out;
    })
    .sort((a, b) => b.wann.localeCompare(a.wann));
  if (zeilen.length === 0) return null;
  return (
    <details className="karte">
      <summary>Verlauf ({zeilen.length})</summary>
      <ol className="einr-verlauf">
        {zeilen.map((z) => (
          <li key={z.id}>
            <span className="leise klein antrag-zeit">{zeit(z.wann)}</span>
            <span>
              <span className={`pille ${z.farbe}`}>{z.was}</span> {z.text}
              {z.zusatz && <span className="leise"> – „{z.zusatz}“</span>}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Formular des Ausbilders: Kennung, ZIP-Datei, Notiz. Fehler des Inhaltspakets stehen direkt darunter.
 * Mit `fest` (Kennung eines vorhandenen Lernmoduls) entfällt das Feld für die Kennung – so wird ein Lernmodul aktualisiert.
 */
export function EinreichenFormular({ maxMb, fest, onEingereicht, onAbbrechen }: { maxMb: number; fest?: string; onEingereicht: () => Promise<void> | void; onAbbrechen?: () => void }) {
  const [kennung, setKennung] = useState(fest ?? '');
  const [notiz, setNotiz] = useState('');
  const [datei, setDatei] = useState<File | null>(null);
  const [nr, setNr] = useState(0);
  const [fehler, setFehler] = useState('');
  const [liste, setListe] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  useUngespeichert((!fest && kennung !== '') || notiz !== '' || datei !== null);
  const zuGross = datei !== null && datei.size > maxMb * 1024 * 1024;

  const sende = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!datei) return;
    setLaeuft(true);
    setFehler('');
    setListe([]);
    const ziel = `/api/lernpakete/einreichungen?kennung=${encodeURIComponent(kennung)}&notiz=${encodeURIComponent(notiz)}`;
    try {
      try {
        await ladeHoch(ziel, datei, 'application/zip');
      } catch (err) {
        // Die neue Fassung hat Folgen für vorhandene Daten (fehlende Kennungen, Paket kommt schon vom Server): erst nachfragen
        const achtung = err instanceof ApiFehler && Array.isArray(err.daten.achtung) ? (err.daten.achtung as string[]) : null;
        if (!achtung) throw err;
        const ja = await rueckfrage(['Lerninhalte trotzdem einreichen?', ...achtung].join('\n\n'), { ja: 'Trotzdem einreichen' });
        if (!ja) {
          setFehler('Nicht eingereicht. Du kannst die Dateien ändern und es noch einmal versuchen.');
          setListe(achtung);
          return;
        }
        await ladeHoch(`${ziel}&bestaetigt=1`, datei, 'application/zip');
      }
      setKennung(fest ?? '');
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

  const dateiFeld = (
    <label>
      ZIP-Datei (höchstens {maxMb} MB)
      <input key={nr} type="file" accept=".zip,application/zip" required onChange={(ev) => setDatei(ev.target.files?.[0] ?? null)} />
    </label>
  );
  return (
    <>
      <p className="leise">
        {fest
          ? 'Lade das ganze Inhaltspaket noch einmal als ZIP-Datei hoch. Das Portal prüft es sofort; nach dem Hochladen durch den Betreiber des Portals ersetzt die neue Fassung die alte.'
          : 'Lade ein Inhaltspaket als ZIP-Datei hoch. Das Portal prüft es sofort, danach sieht es der Betreiber des Portals und lädt es hoch oder gibt es mit einer Rückmeldung zurück.'}{' '}
        <HandbuchLink kapitel="lerninhalte">Lerninhalte für einen Beruf erstellen</HandbuchLink>
      </p>
      <form onSubmit={(ev) => void sende(ev)}>
        {fest ? (
          dateiFeld
        ) : (
          <>
            <div className="reihe">
              <label>
                Kennung des Lernmoduls
                <input value={kennung} onChange={(ev) => setKennung(ev.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9\-]{0,30}" maxLength={31} required placeholder="z. B. kaufleute-buero" autoComplete="off" />
              </label>
              {dateiFeld}
            </div>
            <p className="leise klein">Die Kennung ist der Ordnername: Kleinbuchstaben, Ziffern, Bindestriche. Sie lässt sich später nicht ändern. Gibt es das Lernmodul schon, nimm oben an seiner Karte „Lerninhalte aktualisieren“.</p>
          </>
        )}
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
            {laeuft ? 'Wird hochgeladen und geprüft …' : fest ? 'Neue Fassung einreichen' : 'Lerninhalte einreichen'}
          </button>
          {onAbbrechen && (
            <button type="button" className="knopf schlicht" disabled={laeuft} onClick={onAbbrechen}>
              Abbrechen
            </button>
          )}
        </p>
      </form>
    </>
  );
}
