import { Icon } from '../icons';
import { Avatar } from '../avatar';
import { EintragFelder } from '../eintragFelder';
import { melde, rueckfrage } from '../dialoge';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { FormEvent } from 'react';
import { api, ART_TEXT, berichtsheftPfad, datum, plusTage, STATUS_FARBE, STATUS_TEXT } from '../api';
import type { BerichtListe, BerichtStatus, PlanAntwort, PlanArt, PlanEintrag, PlanWoche, Unteraufgabe } from '../api';
import { Link, useUngespeichert } from '../router';
import { AzubiReiter, ZurueckZuAzubis } from '../azubiReiter';
import { HandbuchLink } from '../handbuchLink';
import { NaviKnopf, useAnsicht } from '../ansicht';

interface Entwurf {
  id: number | null;
  art: PlanArt;
  titel: string;
  von: string;
  bis: string;
  text: string;
  zustaendigId: number | null;
  abteilungId: number | null;
  zuweisen: boolean;
  erledigt: boolean;
  unteraufgaben: Unteraufgabe[];
  tag: string;
  zeitVon: string;
  zeitBis: string;
}

const REIHENFOLGE: PlanArt[] = ['schule', 'einsatz', 'termin', 'aufgabe', 'notiz'];

function EintragFormular({ daten, start, onFertig, onAbbruch }: { daten: PlanAntwort; start: Entwurf; onFertig: (text: string) => Promise<void>; onAbbruch: () => void }) {
  const [e, setE] = useState<Entwurf>(start);
  const [fehler, setFehler] = useState('');
  const basis = `/api/azubis/${daten.azubi.id}/plan`;
  const setze = (teil: Partial<Entwurf>) => setE((alt) => ({ ...alt, ...teil }));
  const mitPerson = (e.art === 'einsatz' || e.art === 'aufgabe') && daten.personen.length > 0;
  const person = daten.personen.find((p) => p.id === e.zustaendigId);
  const kannZuweisen = daten.rechte.zuweisen && e.art === 'einsatz' && person?.rolle === 'beauftragter';

  // Schließen fragt nach, wenn schon etwas eingegeben wurde
  const flaeche = useRef<HTMLElement>(null);
  // schon beim ersten Rendern merken – danach liegt der Fokus bereits im Titelfeld
  const vorher = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const geaendert = useRef(false);
  geaendert.current = JSON.stringify(e) !== JSON.stringify(start);
  useUngespeichert(geaendert.current);
  const schliesse = useCallback(() => {
    if (!geaendert.current) onAbbruch();
    else void rueckfrage('Eingaben verwerfen?\n\nWas du in diesem Fenster eingetragen hast, ist noch nicht gespeichert.', { ja: 'Verwerfen', gefahr: true }).then((ja) => ja && onAbbruch());
  }, [onAbbruch]);

  // Dialog: Escape schließt, Tab bleibt im Dialog, die Seite dahinter scrollt nicht mit,
  // und nach dem Schließen steht der Fokus wieder dort, wo er vorher war
  useEffect(() => {
    document.body.classList.add('dialog-offen');
    const taste = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') schliesse();
      if (ev.key !== 'Tab' || !flaeche.current) return;
      const ziele = [...flaeche.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter((x) => !x.hasAttribute('disabled'));
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      if (ev.shiftKey && document.activeElement === erstes) {
        ev.preventDefault();
        letztes?.focus();
      } else if (!ev.shiftKey && document.activeElement === letztes) {
        ev.preventDefault();
        erstes?.focus();
      }
    };
    window.addEventListener('keydown', taste);
    return () => {
      window.removeEventListener('keydown', taste);
      document.body.classList.remove('dialog-offen');
      vorher.current?.focus();
    };
  }, [schliesse]);

  const sende = async (ev: FormEvent) => {
    ev.preventDefault();
    const body = {
      art: e.art,
      titel: e.titel,
      von: e.von,
      bis: e.bis || e.von,
      ...(e.art === 'termin' ? { tag: e.tag, zeitVon: e.zeitVon, zeitBis: e.zeitBis } : {}),
      text: e.text,
      // mit Abteilung gibt es keine einzelne zuständige Person und keine Zuweisung von Hand
      zustaendigId: mitPerson && !(e.art === 'einsatz' && e.abteilungId) ? e.zustaendigId : null,
      abteilungId: e.art === 'einsatz' ? e.abteilungId : null,
      zuweisen: kannZuweisen && e.zuweisen && !(e.art === 'einsatz' && e.abteilungId),
      erledigt: e.erledigt,
      unteraufgaben: e.unteraufgaben,
    };
    try {
      const r = e.id === null ? await api<{ zugewiesen: boolean }>('POST', basis, body) : await api<{ zugewiesen: boolean }>('PUT', `${basis}/${e.id}`, body);
      await onFertig(`${e.art === 'termin' ? 'Termin' : 'Eintrag'} gespeichert.${r.zugewiesen ? ` ${person?.anzeigename} ist dem Azubi für diesen Zeitraum zugewiesen.` : ''}`);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const loesche = async () => {
    if (e.id === null || !(await rueckfrage(e.art === 'termin' ? `Termin „${e.titel}“ löschen?\n\nEr verschwindet aus deinem Plan und aus deinem abonnierten Kalender.` : `„${e.titel}“ aus dem Plan löschen?\n\nDer Eintrag verschwindet aus allen Wochen, in denen er steht.`, { ja: 'Eintrag löschen', gefahr: true }))) return;
    try {
      await api('DELETE', `${basis}/${e.id}`);
      await onFertig('Eintrag gelöscht.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <div className="dialog-hintergrund" onMouseDown={(ev) => ev.target === ev.currentTarget && schliesse()}>
    <section ref={flaeche} className="karte dialog" id="plan-formular" role="dialog" aria-modal="true" aria-labelledby="plan-formular-titel">
      <h2 id="plan-formular-titel">{e.id === null ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>
      <form className="reihe" onSubmit={(ev) => void sende(ev)}>
        <EintragFelder
          wert={e}
          setze={setze}
          arten={daten.rechte.arten}
          personen={daten.personen}
          autoFokus
          nachZustaendig={
            kannZuweisen && (
              <label className="haken ganz">
                <input type="checkbox" checked={e.zuweisen} onChange={(ev) => setze({ zuweisen: ev.target.checked })} />
                {person?.anzeigename} dem Azubi für diesen Zeitraum zuweisen (darf dann Berichte dieser Wochen abzeichnen)
              </label>
            )
          }
        />
        {fehler && (
          <p className="hinweis fehler ganz" role="alert">
            {fehler}
          </p>
        )}
        <div className="aktionen links ganz">
          <button className="knopf">Eintrag speichern</button>
          <button type="button" className="knopf schlicht" onClick={schliesse}>
            Abbrechen
          </button>
          {e.id !== null && (
            <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
              Eintrag löschen
            </button>
          )}
        </div>
      </form>
    </section>
    </div>
  );
}

// ---------- Hilfen ----------

interface Woche extends PlanWoche {
  sonntag: string;
  /** Ausbildungswoche, gezählt ab 1; 0 = außerhalb der Ausbildung */
  nummer: number;
}

const tagMonat = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const jahrTitel = (j: number) => (j === 0 ? 'Außerhalb der Ausbildung' : `${j}. Ausbildungsjahr`);
/** Monat einer Woche = Monat ihres Donnerstags (wie bei der Kalenderwoche). */
const monatDerWoche = (w: Woche) => new Date(`${plusTage(w.montag, 3)}T00:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
    // ohne Speicher gilt die Auswahl nur bis zum Neuladen
  }
}

/** Höhe dessen, was oben fest stehen bleibt: Kopfzeile und – am PC – die Legende bzw. – darunter – die Zeile „Inhalt“. Ausgeblendetes zählt 0. */
function obenBelegt(): number {
  const hoehe = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().height ?? 0;
  return (document.querySelector('.leiste')?.getBoundingClientRect().height ?? 60) + hoehe('.plan-legende') + hoehe('.plan-inhalt');
}

/** Welche Woche steht gerade oben im Fenster? (aus dem FISI-Lernkompass übernommen) */
function useAktiverAbschnitt(ids: string[]): string | null {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const schluessel = ids.join('|');
  useEffect(() => {
    if (!ids.length) return;
    let frame = 0;
    const pruefe = () => {
      frame = 0;
      let akt: string | null = null;
      // knapp unter der festen Kopfzeile
      const grenze = obenBelegt() + 40;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= grenze) akt = id;
      }
      setAktiv(akt);
    };
    const anstossen = () => {
      if (!frame) frame = requestAnimationFrame(pruefe);
    };
    anstossen();
    window.addEventListener('scroll', anstossen, { passive: true });
    window.addEventListener('resize', anstossen);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', anstossen);
      window.removeEventListener('resize', anstossen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return aktiv;
}

/** liegt der Tag in dieser Woche? */
const d2 = (tag: string | null, w: Woche) => !!tag && tag >= w.montag && tag <= w.sonntag;

interface Aktionen {
  bearbeite: (e: PlanEintrag) => void;
  hake: (e: PlanEintrag, body: { erledigt: boolean; unteraufgabe?: number }) => void;
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const tagKurz = (iso: string) => `${WOCHENTAG[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${tagMonat(iso)}`;
const montagVon = (iso: string) => plusTage(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Ein Plan-Eintrag als Kästchen: links die Art, daneben Titel, darunter Zeitraum, Zuständigkeit, Beschreibung und Unteraufgaben. */
function EintragKarte({ e, woche, voll, eigenes, a }: { e: PlanEintrag; woche: Woche; voll?: boolean; eigenes: boolean; a: Aktionen }) {
  const wochen = Math.round((Date.parse(e.bis) - Date.parse(e.von)) / 604800000) + 1;
  const nr = Math.round((Date.parse(woche.montag) - Date.parse(e.von)) / 604800000) + 1;
  // Beschreibung und Unteraufgaben stehen in der ersten Woche (in den Karten oben immer)
  const ausfuehrlich = voll || e.von === woche.montag;
  const erledigt = e.unteraufgaben.filter((u) => u.erledigt).length;
  const uhr = e.zeitVon ? ` · ${e.zeitVon}${e.zeitBis ? `–${e.zeitBis}` : ''} Uhr` : '';
  const meta = [
    wochen > 1 && `Woche ${nr} von ${wochen} (${tagMonat(e.von)}–${tagMonat(plusTage(e.bis, 6))})`,
    e.zustaendig && `Zuständig: ${e.zustaendig}`,
    e.unteraufgaben.length > 0 && `${erledigt} von ${e.unteraufgaben.length} Unteraufgaben erledigt`,
    // Termine sieht nur der Azubi selbst – das steht dabei, damit er es nicht vergisst
    e.art === 'termin' ? 'nur für dich sichtbar' : e.vomAzubi && (eigenes ? 'von dir eingetragen' : 'vom Azubi eingetragen'),
  ].filter(Boolean);
  // Einsatz in einer Abteilung: in der ersten Woche (und in den Karten oben) ausführlich mit Ansprechpersonen, danach eine Zeile
  if (e.art === 'einsatz' && e.abteilungId !== null) {
    const leute = e.abteilungLeute ?? { beauftragte: [], stellvertretung: [] };
    const erste = e.von === woche.montag;
    const zeitraum = `${tagMonat(e.von)}–${tagMonat(plusTage(e.bis, 6))}`;
    const stand = wochen > 1 && (
      <span className="abt-stand">
        {wochen <= 12 ? (
          <span className="abt-schritte" aria-hidden="true">
            {Array.from({ length: wochen }, (_, i) => (
              <i key={i} className={i < nr ? 'voll' : undefined} />
            ))}
          </span>
        ) : (
          <span className="abt-schritte lang" aria-hidden="true">
            <i className="voll" style={{ width: `${Math.round((nr / wochen) * 100)}%` }} />
          </span>
        )}
        Woche {nr} von {wochen}
      </span>
    );
    const bearbeiten = e.bearbeitbar && (
      <button type="button" className="link-knopf nicht-drucken" onClick={() => a.bearbeite(e)} aria-label={`„${e.titel}“ bearbeiten`}>
        Bearbeiten
      </button>
    );
    if (!ausfuehrlich)
      return (
        <div className="eintrag einsatz abt-kurz">
          <div className="eintrag-kopf">
            <span className="eintrag-art">{ART_TEXT.einsatz}</span>
            <span className="eintrag-titel">{e.titel}</span>
            <span className="eintrag-zusatz">
              {stand}
              {leute.beauftragte.length > 0 && <span> · {leute.beauftragte.join(', ')}</span>}
            </span>
            {bearbeiten}
          </div>
        </div>
      );
    return (
      <>
        {erste && (
          <div className="abt-wechsel">
            <strong>Neue Abteilung: {e.abteilung || e.titel}</strong>
            <span>
              {wochen === 1 ? '1 Woche' : `${wochen} Wochen`}, bis {tagMonat(plusTage(e.bis, 6))}
            </span>
          </div>
        )}
        <div className="eintrag einsatz">
          <div className="eintrag-kopf">
            <span className="eintrag-art">{ART_TEXT.einsatz}</span>
            <span className="eintrag-titel">{e.titel}</span>
            <span className="abt-marke">
              <Icon name="stammdaten" groesse={14} />
              {e.abteilung && e.abteilung !== e.titel ? e.abteilung : 'Abteilung'}
            </span>
            {bearbeiten}
          </div>
          {leute.beauftragte.length + leute.stellvertretung.length > 0 ? (
            <ul className="abt-personen" aria-label={eigenes ? 'Deine Ansprechpersonen' : 'Zuständig in der Abteilung'}>
              {leute.beauftragte.map((n) => (
                <li key={n}>
                  <Avatar name={n} />
                  {n}
                </li>
              ))}
              {leute.stellvertretung.map((n) => (
                <li key={n} className="stv">
                  <Avatar name={n} />
                  {n} <span className="leise klein">(Stellvertretung)</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="eintrag-meta">In dieser Abteilung ist niemand hinterlegt.</div>
          )}
          <div className="eintrag-meta">
            {stand}
            {wochen > 1 ? ' · ' : ''}
            {zeitraum}
            {e.zustaendig ? ` · Zuständig: ${e.zustaendig}` : ''}
          </div>
          {e.text && <div className="eintrag-text mehrzeilig">{e.text}</div>}
        </div>
      </>
    );
  }
  return (
    <div className={`eintrag ${e.art}`}>
      <div className="eintrag-kopf">
        <span className="eintrag-art">{ART_TEXT[e.art]}</span>
        {e.art === 'aufgabe' && (
          <label className="haken nur-haken">
            <input type="checkbox" aria-label={`„${e.titel}“ erledigt`} checked={e.erledigt} onChange={(ev) => a.hake(e, { erledigt: ev.target.checked })} />
          </label>
        )}
        <span className={`eintrag-titel${e.erledigt ? ' erledigt' : ''}`}>{e.titel}</span>
        {e.art === 'termin' && e.tag && (
          <span className="eintrag-zusatz">
            {tagKurz(e.tag)}
            {uhr}
          </span>
        )}
        {e.bearbeitbar && (
          <button type="button" className="link-knopf nicht-drucken" onClick={() => a.bearbeite(e)} aria-label={`„${e.titel}“ bearbeiten`}>
            Bearbeiten
          </button>
        )}
      </div>
      {meta.length > 0 && <div className="eintrag-meta">{meta.join(' · ')}</div>}
      {ausfuehrlich && e.text && <div className="eintrag-text mehrzeilig">{e.text}</div>}
      {ausfuehrlich && e.unteraufgaben.length > 0 && (
        <ul className="unterliste">
          {e.unteraufgaben.map((u, i) => (
            <li key={i}>
              <label className="haken">
                <input type="checkbox" checked={u.erledigt} onChange={(ev) => a.hake(e, { unteraufgabe: i, erledigt: ev.target.checked })} />
                <span className={u.erledigt ? 'erledigt' : undefined}>{u.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Feste Zeile ohne Bearbeitung: Prüfung, Beginn oder Ende der Ausbildung. */
function Marke({ art, klasse, titel, zusatz }: { art: string; klasse: string; titel: string; zusatz: string }) {
  return (
    <div className={`eintrag ${klasse}`}>
      <div className="eintrag-kopf">
        <span className="eintrag-art">{art}</span>
        <span className="eintrag-titel">{titel}</span>
        <span className="eintrag-zusatz">{zusatz}</span>
      </div>
    </div>
  );
}

/**
 * Alles, was in einer Woche ansteht – in fester Reihenfolge: Prüfungen, Beginn/Ende, Schule, Einsatz, Aufgaben, Notizen,
 * zuletzt Ferien und Feiertage. `voll` zeigt Beschreibung und Unteraufgaben immer (Karten oben).
 */
function WochenInhalt({ woche, daten, frei, voll, leer, a }: { woche: Woche; daten: PlanAntwort; frei: boolean; voll?: boolean; leer?: string; a: Aktionen }) {
  const eintraege = daten.eintraege.filter((e) => e.von <= woche.montag && e.bis >= woche.montag).sort((x, y) => REIHENFOLGE.indexOf(x.art) - REIHENFOLGE.indexOf(y.art) || x.von.localeCompare(y.von) || (x.tag ?? '').localeCompare(y.tag ?? '') || x.zeitVon.localeCompare(y.zeitVon) || x.id - y.id);
  const pruefungen = daten.pruefungen.filter((p) => d2(p.datum, woche));
  const ferien = frei ? daten.ferien.filter((f) => f.von <= woche.sonntag && f.bis >= woche.montag) : [];
  const feiertage = frei ? daten.feiertage.filter((f) => f.datum >= woche.montag && f.datum <= woche.sonntag) : [];
  // Termine des Betriebs für alle stehen immer da – auch wenn Ferien und Feiertage ausgeblendet sind
  const firma = daten.firmentermine.filter((t) => t.von <= woche.sonntag && t.bis >= woche.montag);
  const beginnt = d2(daten.beginn, woche);
  const endet = d2(daten.ende, woche);
  if (!eintraege.length && !pruefungen.length && !ferien.length && !feiertage.length && !firma.length && !beginnt && !endet) return leer ? <p className="leise klein">{leer}</p> : null;
  return (
    <>
      {pruefungen.map((p) => (
        <Marke key={p.bezeichnung + p.datum} art={p.planer ? 'Prüfungstermin' : 'Prüfung'} klasse="pruefung" titel={p.bezeichnung} zusatz={tagKurz(p.datum)} />
      ))}
      {firma.map((t) => (
        <Marke key={`firma-${t.id}`} art="Firmentermin" klasse="firma" titel={t.hinweis ? `${t.titel} – ${t.hinweis}` : t.titel} zusatz={t.von === t.bis ? tagKurz(t.von) : `${tagMonat(t.von)}–${tagMonat(t.bis)}`} />
      ))}
      {beginnt && <Marke art="Start" klasse="marke" titel="Ausbildungsbeginn" zusatz={tagKurz(daten.beginn!)} />}
      {endet && <Marke art="Ende" klasse="marke" titel="Ende der Ausbildung" zusatz={tagKurz(daten.ende!)} />}
      {eintraege.map((e) => (
        <EintragKarte key={e.id} e={e} woche={woche} voll={voll} eigenes={daten.eigenes} a={a} />
      ))}
      {(ferien.length > 0 || feiertage.length > 0) && (
        <div className="frei-zeile">
          {ferien.map((f) => (
            <span className="pille ferien" key={f.name + f.von}>
              {f.name} {tagMonat(f.von)}–{tagMonat(f.bis)}
            </span>
          ))}
          {feiertage.map((f) => (
            <span className="pille umrandet" key={f.datum}>
              Feiertag: {f.name} · {tagKurz(f.datum)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function BerichtLink({ basis, montag, status, eigenes }: { basis: string; montag: string; status: BerichtStatus; eigenes: boolean }) {
  return (
    <Link zu={`${basis}/${montag}`} className={`pille ${STATUS_FARBE[status]} bericht-link`}>
      {status === 'fehlt' && eigenes ? '+ Bericht schreiben' : `Bericht: ${STATUS_TEXT[status]}`}
    </Link>
  );
}

/** Karte „Diese Woche“ bzw. „Nächste Woche“ oben auf der Seite. */
function WochenKarte({ titel, woche, ersatz, gesamt, schule, daten, frei, plant, bericht, basis, onNeu, onZeigen, hervorheben, a }: {
  titel: string;
  woche: Woche | null;
  ersatz: string;
  gesamt: number;
  schule: boolean;
  daten: PlanAntwort;
  frei: boolean;
  plant: boolean;
  bericht?: BerichtStatus;
  basis: string;
  onNeu: (w: Woche, art?: PlanArt) => void;
  onZeigen: (montag: string) => void;
  hervorheben?: boolean;
  a: Aktionen;
}) {
  return (
    <section aria-label={titel} className={`karte wochenkarte${hervorheben ? ' hervor' : ''}`}>
      <div className="wochenkarte-kopf">
        <div>
          <span className="ueberschrift-klein">{titel}</span>
          <h2>{woche ? `KW ${woche.kw} · ${tagMonat(woche.montag)}–${tagMonat(woche.sonntag)}` : '—'}</h2>
          <p className="leise klein">{!woche ? ersatz : woche.nummer === 0 ? 'außerhalb der Ausbildung' : `${woche.ausbildungsjahr}. Ausbildungsjahr · Woche ${woche.nummer} von ${gesamt}`}</p>
        </div>
        {woche && <span className={`pille ${schule ? 'violett' : 'grau'}`}>{schule ? 'Schulwoche' : 'Betrieb'}</span>}
      </div>
      {woche && <WochenInhalt woche={woche} daten={daten} frei={frei} voll leer="Noch nichts eingetragen." a={a} />}
      {woche && (
        <div className="wochenkarte-fuss nicht-drucken">
          {plant && (
            <button type="button" className="knopf schlicht" onClick={() => onNeu(woche)}>
              + Eintrag
            </button>
          )}
          {daten.rechte.arten.includes('termin') && (
            <button type="button" className="knopf schlicht" onClick={() => onNeu(woche, 'termin')}>
              + Termin
            </button>
          )}
          <button type="button" className="knopf schlicht" onClick={() => onZeigen(woche.montag)}>
            Im Plan zeigen
          </button>
          {bericht && <BerichtLink basis={basis} montag={woche.montag} status={bericht} eigenes={daten.eigenes} />}
        </div>
      )}
    </section>
  );
}

function Kennzahl({ wert, einheit, text, warnung, children }: { wert: number | string; einheit: string; text: string; warnung?: boolean; children?: React.ReactNode }) {
  return (
    <div className="kennzahl">
      <div>
        <span className="kennzahl-wert">{wert}</span> <strong>{einheit}</strong>
      </div>
      <span className={warnung ? 'kennzahl-warnung klein' : 'leise klein'}>{text}</span>
      {children}
    </div>
  );
}

/** Ein schmaler Balken pro Woche: Schule violett, Ferien gelb, heute blau; die gelesene Woche ist höher. */
function Jahresband({ wochen, schule, abteilung, ferien, pruefung, heute, gelesen, onSpringe }: { wochen: Woche[]; schule: Set<string>; abteilung: Map<string, string>; ferien: Set<string>; pruefung: Set<string>; heute?: string; gelesen?: string; onSpringe: (montag: string) => void }) {
  const schulAnzahl = wochen.filter((w) => schule.has(w.montag)).length;
  return (
    <div role="img" aria-label={`${wochen.length} Wochen, davon ${schulAnzahl} Schulwochen`} className="jahresband">
      {wochen.map((w) => (
        <span
          key={w.montag}
          title={`KW ${w.kw} · ${tagMonat(w.montag)}–${tagMonat(w.sonntag)}${abteilung.has(w.montag) ? ` · ${abteilung.get(w.montag)}` : ''}`}
          onClick={() => onSpringe(w.montag)}
          className={`${pruefung.has(w.montag) ? 'pruefung' : w.montag === heute ? 'heute' : schule.has(w.montag) ? 'schule' : abteilung.has(w.montag) ? 'abteilung' : ferien.has(w.montag) ? 'ferien' : ''}${w.montag === gelesen ? ' gelesen' : ''}`}
        />
      ))}
    </div>
  );
}

/** Ein Stück des Abteilungsdurchlaufs: ein Einsatz in einer Abteilung oder eine Lücke („noch nicht geplant“). Montage der ersten und letzten Woche. */
interface Abschnitt {
  name: string | null;
  von: string;
  bis: string;
  kwVon: number;
  kwBis: number;
}

/** Die Abteilungen der Reihe nach – am PC in der Seitenleiste (je Jahr), darunter in der Zeile „Inhalt“. */
function Durchlauf({ abschnitte, heute, onSpringe }: { abschnitte: Abschnitt[]; heute?: string; onSpringe: (montag: string) => void }) {
  if (!abschnitte.some((x) => x.name !== null)) return null;
  const liste = (
    <ul className="abt-durchlauf">
      {abschnitte.map((x) => {
        const jetzt = !!heute && x.von <= heute && x.bis >= heute;
        return (
          <li key={x.von}>
            <button type="button" onClick={() => onSpringe(x.von)} aria-current={jetzt ? 'true' : undefined} className={x.name === null ? 'offen' : undefined}>
              <i aria-hidden="true" />
              <span>
                <strong>{x.name ?? 'Noch nicht geplant'}</strong>
                <span className="leise klein">
                  KW {x.kwVon}
                  {x.kwBis !== x.kwVon ? `–${x.kwBis}` : ''}
                  {jetzt && x.name !== null ? ' · läuft gerade' : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div>
      <span className="ueberschrift-klein abt-durchlauf-titel">Abteilungen</span>
      {liste}
    </div>
  );
}

/** Seitenleiste: wo man gerade liest, Fortschritt der Ausbildung und je Jahr ein Band aller Wochen. */
function PlanKompass({ jahre, gelesen, heute, gesamt, schule, abteilung, durchlauf, ferien, pruefung, onSpringe }: { jahre: Map<number, Woche[]>; gelesen: Woche | null; heute: Woche | null; gesamt: number; schule: Set<string>; abteilung: Map<string, string>; durchlauf: Abschnitt[]; ferien: Set<string>; pruefung: Set<string>; onSpringe: (montag: string) => void }) {
  const ort = gelesen ?? heute;
  const fortschritt = heute && heute.nummer ? Math.min(100, Math.round((heute.nummer / gesamt) * 100)) : null;
  return (
    <nav aria-label="Übersicht Ausbildungsplan" className="kompass">
      {ort && (
        <div aria-live="polite" className="kompass-ort">
          <span className="ueberschrift-klein">Du bist hier</span>
          <strong className="gross">{jahrTitel(ort.ausbildungsjahr ?? 0)}</strong>
          <span className="klein">
            {monatDerWoche(ort)} · KW {ort.kw}
          </span>
          {ort.nummer > 0 && (
            <span className="leise klein">
              Ausbildungswoche {ort.nummer} von {gesamt}
            </span>
          )}
          <span>
            <span className={`pille ${schule.has(ort.montag) ? 'violett' : 'grau'}`}>{schule.has(ort.montag) ? 'Schulwoche' : 'Betrieb'}</span>
          </span>
          {heute && ort.montag !== heute.montag && (
            <button type="button" className="link-knopf klein" onClick={() => onSpringe(heute.montag)}>
              Zur aktuellen Woche
            </button>
          )}
        </div>
      )}

      {fortschritt !== null && heute && (
        <div className="kompass-teil">
          <div className="kompass-zeile">
            <span className="ueberschrift-klein">Ausbildung</span>
            <strong className="klein">{fortschritt} %</strong>
          </div>
          <div role="img" aria-label={`Heute Ausbildungswoche ${heute.nummer} von ${gesamt}, ${fortschritt} Prozent geschafft`} className="balken">
            <span style={{ width: `${fortschritt}%` }} />
          </div>
          <span className="leise klein">
            Heute Woche {heute.nummer} von {gesamt}
          </span>
        </div>
      )}

      <ol className="kompass-teil kompass-jahre">
        {[...jahre.entries()].map(([jahr, ws]) => {
          const aktiv = (ort?.ausbildungsjahr ?? 0) === jahr && !!ort;
          const monate: { name: string; montag: string }[] = [];
          for (const w of ws) {
            const m = monatDerWoche(w);
            if (monate[monate.length - 1]?.name !== m) monate.push({ name: m, montag: w.montag });
          }
          const ortMonat = ort ? monatDerWoche(ort) : '';
          return (
            <li key={jahr}>
              <button type="button" className="kompass-jahr" onClick={() => onSpringe(ws[0].montag)} aria-current={aktiv ? 'location' : undefined}>
                <strong className="klein">{jahrTitel(jahr)}</strong>
                <span className="klein">
                  {tagMonat(ws[0].montag)}
                  {ws[0].montag.slice(2, 4)} – {tagMonat(ws[ws.length - 1].sonntag)}
                  {ws[ws.length - 1].sonntag.slice(2, 4)} · {ws.filter((w) => schule.has(w.montag)).length} Schulw.
                </span>
              </button>
              <Jahresband wochen={ws} schule={schule} abteilung={abteilung} ferien={ferien} pruefung={pruefung} heute={heute?.montag} gelesen={ort?.montag} onSpringe={onSpringe} />
              {aktiv && monate.length > 1 && (
                <ul className="kompass-monate">
                  {monate.map((m) => (
                    <li key={m.montag}>
                      <button type="button" onClick={() => onSpringe(m.montag)} aria-current={m.name === ortMonat ? 'location' : undefined}>
                        {m.name.replace(/ \d{2}(\d{2})$/, ' ’$1')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {aktiv && <Durchlauf abschnitte={durchlauf.filter((x) => x.bis >= ws[0].montag && x.von <= ws[ws.length - 1].montag)} heute={heute?.montag} onSpringe={onSpringe} />}
            </li>
          );
        })}
      </ol>

      <div className="kompass-teil kompass-legende leise klein" aria-hidden="true">
        <span>
          <i className="schule" /> Schule
        </span>
        {abteilung.size > 0 && (
          <span>
            <i className="abteilung" /> Abteilung
          </span>
        )}
        {pruefung.size > 0 && (
          <span>
            <i className="pruefung" /> Prüfung
          </span>
        )}
        {ferien.size > 0 && (
          <span>
            <i className="ferien" /> Ferien
          </span>
        )}
        <span>
          <i className="heute" /> Heute
        </span>
      </div>
    </nav>
  );
}

/** Ausbildungsplan eines Azubis – Aufbau wie im FISI-Lernkompass: oben diese und nächste Woche, links die Übersicht, rechts alle Kalenderwochen. */
export function PlanSeite({ azubiId }: { azubiId: number }) {
  const [d, setD] = useState<PlanAntwort | null>(null);
  const [berichte, setBerichte] = useState<BerichtListe | null>(null);
  const [fehler, setFehler] = useState('');
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [vorlage, setVorlage] = useState('');
  // Startwoche für „Baustein einfügen“; leer = Vorschlag (laufende Woche bzw. erste Woche der Ausbildung)
  const [bausteinAb, setBausteinAb] = useState('');
  const [nurBelegt, setNurBelegtRoh] = useState(() => lies('plan-nur-belegt') === '1');
  const [zeigeFrei, setZeigeFreiRoh] = useState(() => lies('plan-ferien') !== '0');
  const setNurBelegt = (x: boolean) => {
    setNurBelegtRoh(x);
    merke('plan-nur-belegt', x ? '1' : '0');
  };
  const setZeigeFrei = (x: boolean) => {
    setZeigeFreiRoh(x);
    merke('plan-ferien', x ? '1' : '0');
  };

  const lade = useCallback(async () => {
    setD(await api<PlanAntwort>('GET', `/api/azubis/${azubiId}/plan`));
  }, [azubiId]);
  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
    api<BerichtListe>('GET', `/api/azubis/${azubiId}/berichte`).then(setBerichte, () => {});
  }, [lade, azubiId]);
  const schliesse = useCallback(() => setEntwurf(null), []);

  const wochen = useMemo(() => {
    let nr = 0;
    return (d?.wochen ?? []).map((w): Woche => ({ ...w, sonntag: plusTage(w.montag, 6), nummer: w.ausbildungsjahr === null ? 0 : ++nr }));
  }, [d?.wochen]);
  const schule = useMemo(() => {
    const s = new Set<string>();
    for (const e of d?.eintraege ?? []) if (e.art === 'schule') for (let m = e.von; m <= e.bis; m = plusTage(m, 7)) s.add(m);
    return s;
  }, [d?.eintraege]);
  // Ferienwoche = mindestens drei Werktage Ferien (einzelne freie Tage färben das Band nicht)
  const ferienWochen = useMemo(() => {
    const s = new Set<string>();
    if (!d || !zeigeFrei) return s;
    for (const w of wochen) {
      let tage = 0;
      for (let i = 0; i < 5; i++) {
        const tag = plusTage(w.montag, i);
        if (d.ferien.some((f) => f.von <= tag && f.bis >= tag)) tage++;
      }
      if (tage >= 3) s.add(w.montag);
    }
    return s;
  }, [d, wochen, zeigeFrei]);

  // Wochen in einer Abteilung (Montag → Name) und der Durchlauf: Abteilungen der Reihe nach, ab heute mit den Lücken dazwischen
  const abteilungsWochen = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of d?.eintraege ?? []) if (e.art === 'einsatz' && e.abteilungId !== null) for (let w = e.von; w <= e.bis; w = plusTage(w, 7)) m.set(w, e.abteilung || e.titel);
    return m;
  }, [d?.eintraege]);
  const durchlauf = useMemo(() => {
    const aus: Abschnitt[] = [];
    if (abteilungsWochen.size === 0) return aus;
    // verplant ist eine Woche auch durch Berufsschule oder einen Einsatz ohne Abteilung – das ist keine Lücke
    const verplant = new Set<string>(schule);
    for (const e of d?.eintraege ?? []) if (e.art === 'einsatz') for (let w = e.von; w <= e.bis; w = plusTage(w, 7)) verplant.add(w);
    const heuteMontag = d ? montagVon(d.heute) : '';
    let jahr: number | null = null;
    for (const w of wochen) {
      if (w.ausbildungsjahr === null) continue;
      const name = abteilungsWochen.get(w.montag) ?? null;
      // Lücken nur ab der laufenden Woche – was vorbei ist, muss niemand mehr planen
      const art = name !== null ? name : !verplant.has(w.montag) && w.montag >= heuteMontag ? null : undefined;
      const letzter = aus[aus.length - 1];
      if (art === undefined) {
        jahr = null;
        continue;
      }
      // ein Abschnitt endet am Wechsel der Abteilung und an der Grenze des Ausbildungsjahres
      if (letzter && jahr === w.ausbildungsjahr && letzter.name === art && plusTage(letzter.bis, 7) === w.montag) {
        letzter.bis = w.montag;
        letzter.kwBis = w.kw;
      } else aus.push({ name: art, von: w.montag, bis: w.montag, kwVon: w.kw, kwBis: w.kw });
      jahr = w.ausbildungsjahr;
    }
    return aus;
  }, [abteilungsWochen, schule, wochen, d]);

  const pruefungsWochen = useMemo(() => new Set((d?.pruefungen ?? []).map((p) => montagVon(p.datum))), [d?.pruefungen]);

  const istBelegt = (w: Woche) => !!d && (w.montag <= d.heute && w.sonntag >= d.heute ? true : w.nummer === 1 || d2(d.ende, w) || pruefungsWochen.has(w.montag) || d.eintraege.some((e) => e.von <= w.montag && e.bis >= w.montag));
  const sichtbar = nurBelegt ? wochen.filter(istBelegt) : wochen;
  const gelesenId = useAktiverAbschnitt(sichtbar.map((w) => `kw-${w.montag}`));
  const { naviZu } = useAnsicht();
  // unter 1024 px: die angeheftete Zeile „Inhalt“ – klappt nach einer Auswahl wieder zu
  const [inhaltOffen, setInhaltOffen] = useState(false);

  if (fehler) {
    return (
      <>
        <h1>Ausbildungsplan nicht gefunden</h1>
        <p className="leise">{fehler}</p>
      </>
    );
  }
  if (!d) return <p className="leise">Lädt …</p>;

  const aktuelle = wochen.find((w) => w.montag <= d.heute && w.sonntag >= d.heute) ?? null;
  const bausteinVorschlag = d.beginn && d.ende && d.heute >= d.beginn && d.heute <= d.ende ? d.heute : (d.beginn ?? '');
  const dieseWoche = aktuelle?.montag ?? '';
  const naechste = aktuelle ? (wochen.find((w) => w.montag === plusTage(aktuelle.montag, 7)) ?? null) : null;
  const gesamt = wochen.filter((w) => w.nummer > 0).length;
  const gelesen = sichtbar.find((w) => `kw-${w.montag}` === gelesenId) ?? null;
  const plant = d.rechte.arten.length > 0;
  const basis = berichtsheftPfad(azubiId, d.eigenes);
  const berichtStatus = new Map((berichte?.wochen ?? []).map((w) => [w.montag, w.status]));

  const jahre = new Map<number, Woche[]>();
  for (const w of wochen) jahre.set(w.ausbildungsjahr ?? 0, [...(jahre.get(w.ausbildungsjahr ?? 0) ?? []), w]);

  const legende = (
    <>
                <span>
                  <i className="streifen" /> Schulwoche
                </span>
                {REIHENFOLGE.filter((art) => art !== 'termin' || d.rechte.arten.includes('termin')).map((art) => (
                  <span key={art} className={`legende-art ${art}`}>
                    {ART_TEXT[art]}
                  </span>
                ))}
                {d.pruefungen.length > 0 && <span className="legende-art pruefung">Prüfung</span>}
                {zeigeFrei && <span className="pille ferien">Schulferien</span>}
                {zeigeFrei && <span className="pille umrandet">Feiertag</span>}
    </>
  );
  const ort = gelesen ?? aktuelle;
  const springe = (montag: string) => {
    setInhaltOffen(false);
    zeige(montag);
  };

  const offen = d.eintraege.filter((e) => e.art === 'aufgabe' && !e.erledigt);
  const ueberfaellig = offen.filter((e) => dieseWoche && e.bis < dieseWoche);
  const faellig = (berichte?.wochen ?? []).filter((w) => dieseWoche && w.montag < dieseWoche);
  const fehlend = faellig.filter((w) => w.status === 'fehlt');
  const zurueck = (berichte?.wochen ?? []).filter((w) => w.status === 'zurueck');
  const rest = aktuelle && aktuelle.nummer ? gesamt - aktuelle.nummer : null;
  // nächste eingetragene Prüfung; ohne Prüfungstermin zählt die Kachel bis zum Ende der Ausbildung
  const pruefung = d.pruefungen.find((p) => !p.planer && p.datum >= d.heute) ?? null;
  const bisPruefung = pruefung ? Math.round((Date.parse(montagVon(pruefung.datum)) - Date.parse(montagVon(d.heute))) / 604800000) : 0;

  const neu = (w: Woche | null, art?: PlanArt): Entwurf => ({ id: null, art: art ?? (d.rechte.arten.includes('einsatz') ? 'einsatz' : 'aufgabe'), titel: '', von: w?.montag ?? d.heute, bis: '', text: '', zustaendigId: null, abteilungId: null, zuweisen: true, erledigt: false, unteraufgaben: [], tag: w && !(w.montag <= d.heute && w.sonntag >= d.heute) ? w.montag : d.heute, zeitVon: '', zeitBis: '' });
  const oeffne = (e: Entwurf) => {
    setMeldung(null);
    setEntwurf(e);
  };
  const zeige = (montag: string) => {
    if (nurBelegt && !document.getElementById(`kw-${montag}`)) setNurBelegt(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(`kw-${montag}`);
        if (!el) return;
        // knapp unter Kopfzeile und Legende, die beide stehen bleiben
        const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - obenBelegt() - 12, behavior: ruhig ? 'auto' : 'smooth' });
      }),
    );
  };
  const hake = async (e: PlanEintrag, body: { erledigt: boolean; unteraufgabe?: number }) => {
    const ersetze = (x: PlanEintrag) => setD((alt) => (alt ? { ...alt, eintraege: alt.eintraege.map((y) => (y.id === e.id ? x : y)) } : alt));
    // sofort anzeigen, dann mit der Antwort des Servers abgleichen
    ersetze(body.unteraufgabe === undefined ? { ...e, erledigt: body.erledigt } : { ...e, unteraufgaben: e.unteraufgaben.map((u, i) => (i === body.unteraufgabe ? { ...u, erledigt: body.erledigt } : u)) });
    try {
      ersetze((await api<{ eintrag: PlanEintrag }>('POST', `/api/azubis/${azubiId}/plan/${e.id}/haken`, body)).eintrag);
    } catch (err) {
      ersetze(e);
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };
  const a: Aktionen = {
    bearbeite: (e) => oeffne({ id: e.id, art: e.art, titel: e.titel, von: e.von, bis: e.bis === e.von ? '' : plusTage(e.bis, 6), text: e.text, zustaendigId: e.zustaendigId, abteilungId: e.abteilungId, zuweisen: false, erledigt: e.erledigt, unteraufgaben: e.unteraufgaben, tag: e.tag ?? e.von, zeitVon: e.zeitVon, zeitBis: e.zeitBis }),
    hake: (e, body) => void hake(e, body),
  };
  const uebernimm = async () => {
    const v = d.vorlagen.find((x) => String(x.id) === vorlage);
    const ab = bausteinAb || bausteinVorschlag;
    if (!v || !ab) return;
    const kw = d.wochen.find((w) => w.montag <= ab && plusTage(w.montag, 6) >= ab);
    if (!(await rueckfrage(`Baustein „${v.titel}“ ab ${kw ? `KW ${kw.kw}/${kw.jahr}` : datum(ab)} in diesen Plan einfügen?\n\nDie Einträge kommen zu den vorhandenen dazu.`, { ja: 'Baustein einfügen' }))) return;
    try {
      const r = await api<{ uebernommen: number }>('POST', `/api/azubis/${azubiId}/plan/vorlage`, { vorlageId: v.id, ab });
      await lade();
      setMeldung(null);
      melde(`${r.uebernommen === 1 ? '1 Eintrag' : `${r.uebernommen} Einträge`} aus dem Baustein eingefügt.`);
      if (kw) zeige(kw.montag);
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <>
      {!d.eigenes && <ZurueckZuAzubis />}
      <h1>Ausbildungsplan{d.eigenes ? '' : ` von ${d.azubi.anzeigename}`}</h1>
      {!d.eigenes && <AzubiReiter id={azubiId} name={d.azubi.anzeigename} />}
      <p className="leise">
        {d.beruf ? `${d.beruf} · ` : ''}
        {d.eigenes
          ? 'Deine Ausbildung Woche für Woche – Schulblöcke, Einsätze, Aufgaben und Notizen. Du kannst eigene Aufgaben, Notizen und Termine (zum Beispiel eine JAV-Sitzung) eintragen und Aufgaben abhaken. Termine siehst nur du.'
          : d.rechte.arten.includes('einsatz')
            ? 'Die Ausbildung Woche für Woche – Schulblöcke, Einsätze, Aufgaben und Notizen. Jeder Eintrag lässt sich über „Bearbeiten“ ändern.'
            : plant
              ? 'Du kannst Aufgaben und Notizen anlegen; Schulblöcke und Einsätze plant der Ausbilder.'
              : 'Nur zur Ansicht.'}{' '}
        Schule, Einsätze und Prüfungen lassen sich unter <Link zu="/konto">Konto</Link> als Kalender abonnieren. <HandbuchLink kapitel="plan">{d.eigenes ? 'Den Ausbildungsplan lesen' : 'Ausbildungsplan'}</HandbuchLink>
      </p>
      <p className="aktionen links nicht-drucken">
        <Link zu={d.eigenes ? '/jahreskalender' : `/jahreskalender/${azubiId}`} className="knopf schlicht">
          Jahreskalender anzeigen
        </Link>
        <Link zu={d.eigenes ? '/urlaub' : `/azubis/${azubiId}/urlaub`} className="knopf schlicht">
          {d.eigenes ? 'Urlaub beantragen' : 'Urlaub ansehen'}
        </Link>
      </p>

      {d.beginnFehlt && (
        <p className="hinweis">
          {d.eigenes ? 'Für dich ist noch kein Ausbildungsbeginn eingetragen. Bitte wende dich an deinen Ausbilder.' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil – erst dann gibt es Wochen zum Planen.'}
        </p>
      )}
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}

      {entwurf && (
        <EintragFormular
          key={`${entwurf.id}-${entwurf.von}`}
          daten={d}
          start={entwurf}
          onAbbruch={schliesse}
          onFertig={async (text) => {
            await lade();
            setEntwurf(null);
            setMeldung(null);
            melde(text);
          }}
        />
      )}

      {wochen.length > 0 && (
        <>
          <section className="plan-oben">
            <WochenKarte
              titel="Diese Woche"
              woche={aktuelle}
              ersatz={wochen[0].montag > d.heute ? 'Die Ausbildung hat noch nicht begonnen.' : 'Die laufende Woche liegt außerhalb der Ausbildung.'}
              gesamt={gesamt}
              schule={!!aktuelle && schule.has(aktuelle.montag)}
              daten={d}
              frei={zeigeFrei}
              plant={plant}
              bericht={aktuelle ? berichtStatus.get(aktuelle.montag) : undefined}
              basis={basis}
              onNeu={(w, art) => oeffne(neu(w, art))}
              onZeigen={zeige}
              hervorheben
              a={a}
            />
            <WochenKarte
              titel="Nächste Woche"
              woche={naechste}
              ersatz="Die nächste Woche liegt außerhalb der Ausbildung."
              gesamt={gesamt}
              schule={!!naechste && schule.has(naechste.montag)}
              daten={d}
              frei={zeigeFrei}
              plant={plant}
              basis={basis}
              onNeu={(w, art) => oeffne(neu(w, art))}
              onZeigen={zeige}
              a={a}
            />
            <div className="karte kennzahlen">
              {pruefung ? (
                <Kennzahl wert={bisPruefung} einheit={bisPruefung === 1 ? 'Woche' : 'Wochen'} text={`bis zur Prüfung „${pruefung.bezeichnung}“ (${tagKurz(pruefung.datum)}${pruefung.datum.slice(0, 4)})`}>
                  {d.pruefungen
                    .filter((p) => p !== pruefung && !p.planer && p.datum > d.heute)
                    .map((p) => (
                      <span className="leise klein" key={p.bezeichnung + p.datum}>
                        danach: {p.bezeichnung} am {datum(p.datum)}
                      </span>
                    ))}
                  <span className="leise klein">Ende der Ausbildung: {datum(d.ende)}</span>
                </Kennzahl>
              ) : (
                <Kennzahl wert={rest ?? '–'} einheit={rest === null ? '' : rest === 1 ? 'Woche' : 'Wochen'} text={rest === null ? 'Die laufende Woche liegt außerhalb der Ausbildung' : `bis zum Ende der Ausbildung (${datum(d.ende)})`}>
                  {d.rechte.zuweisen && (
                    <Link zu={`/azubis/${azubiId}`} className="klein">
                      Prüfungstermine im Profil eintragen
                    </Link>
                  )}
                </Kennzahl>
              )}
              {berichte && !berichte.beginnFehlt && (
                <Kennzahl wert={fehlend.length} einheit={fehlend.length === 1 ? 'Bericht fehlt' : 'Berichte fehlen'} text={`${faellig.length - fehlend.length} von ${faellig.length} fälligen Wochen geschrieben`} warnung={fehlend.length > 0}>
                  {zurueck.length > 0 && (
                    <span className="kennzahl-warnung klein">
                      {zurueck.length} {zurueck.length === 1 ? 'Bericht wurde' : 'Berichte wurden'} zurückgegeben – bitte überarbeiten
                    </span>
                  )}
                  <Link zu={basis} className="klein">
                    Zum Berichtsheft
                  </Link>
                </Kennzahl>
              )}
              <Kennzahl wert={offen.length} einheit={offen.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'} text={ueberfaellig.length ? `davon ${ueberfaellig.length} überfällig` : 'nichts überfällig'} warnung={ueberfaellig.length > 0} />
            </div>
          </section>

          <div className={`plan-bereich${naviZu ? ' navi-zu' : ''}`}>
            {naviZu ? (
              <aside className="karte plan-seite schmal nicht-drucken" aria-label="Übersicht Ausbildungsplan">
                <NaviKnopf was="Inhalt" />
                <ul className="lern-navi-schmal">
                  {[...jahre.entries()].map(([j, ws]) => (
                    <li key={j}>
                      <button type="button" className="lern-navi-nr" title={jahrTitel(j)} aria-label={jahrTitel(j)} aria-current={(ort?.ausbildungsjahr ?? 0) === j ? 'location' : undefined} onClick={() => zeige(ws[0].montag)}>
                        {j === 0 ? '–' : j}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : (
              <aside className="karte plan-seite nicht-drucken">
                <div className="navi-kopf">
                  <h2>Inhalt</h2>
                  <NaviKnopf was="Inhalt" />
                </div>
                <PlanKompass jahre={jahre} gelesen={gelesen} heute={aktuelle} gesamt={gesamt} schule={schule} abteilung={abteilungsWochen} durchlauf={durchlauf} ferien={ferienWochen} pruefung={pruefungsWochen} onSpringe={zeige} />
              </aside>
            )}

            <div className="plan-wochen">
              <section aria-label="Ansicht" className="filter nicht-drucken">
                <div role="group" aria-label="Wochen anzeigen" className="umschalter">
                  <button type="button" aria-pressed={!nurBelegt} onClick={() => setNurBelegt(false)}>
                    Alle Wochen
                  </button>
                  <button type="button" aria-pressed={nurBelegt} onClick={() => setNurBelegt(true)}>
                    Nur mit Einträgen
                  </button>
                </div>
                <label className="haken">
                  <input type="checkbox" checked={zeigeFrei} onChange={(e) => setZeigeFrei(e.target.checked)} />
                  Ferien und Feiertage
                </label>
                {plant && (
                  <button type="button" className="knopf rechts" onClick={() => oeffne(neu(aktuelle))}>
                    Eintrag hinzufügen
                  </button>
                )}
              </section>
              {/* unter 1024 px statt der Seitenleiste: die Zeile „Inhalt“ – bleibt beim Rollen stehen und zeigt, wo man liest */}
              <details className="karte lern-navi-klapp plan-inhalt nicht-drucken" open={inhaltOffen} onToggle={(e) => setInhaltOffen(e.currentTarget.open)}>
                <summary>
                  <span className="handbuch-kopf">
                    <span>Inhalt</span>
                    {!inhaltOffen && ort && (
                      <span className="handbuch-wo">
                        {jahrTitel(ort.ausbildungsjahr ?? 0)} · KW {ort.kw}
                      </span>
                    )}
                  </span>
                </summary>
                <nav aria-label="Übersicht Ausbildungsplan">
                  <ul className="lern-navi-liste">
                    {[...jahre.entries()].map(([j, ws]) => (
                      <li key={j}>
                        <button type="button" className="lern-navi-feld" aria-current={(ort?.ausbildungsjahr ?? 0) === j ? 'location' : undefined} onClick={() => springe(ws[0].montag)}>
                          <span className="lern-navi-titel">{jahrTitel(j)}</span>
                          <span className="lern-navi-prozent">
                            KW {ws[0].kw}/{ws[0].montag.slice(2, 4)} – {ws[ws.length - 1].kw}/{ws[ws.length - 1].sonntag.slice(2, 4)}
                          </span>
                        </button>
                      </li>
                    ))}
                    {aktuelle && (
                      <li>
                        <button type="button" className="lern-navi-feld" onClick={() => springe(aktuelle.montag)}>
                          <span className="lern-navi-titel">Diese Woche</span>
                          <span className="lern-navi-prozent">KW {aktuelle.kw}</span>
                        </button>
                      </li>
                    )}
                  </ul>
                  <Durchlauf abschnitte={durchlauf} heute={aktuelle?.montag} onSpringe={springe} />
                  <p className="lern-navi-zwischen">Farben</p>
                  <div className="plan-inhalt-legende leise klein">{legende}</div>
                </nav>
              </details>

              {d.vorlagen.length > 0 && !d.beginnFehlt && (
                <div className="filter nicht-drucken baustein-leiste">
                  <select aria-label="Baustein" value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
                    <option value="">– Baustein wählen –</option>
                    {d.vorlagen.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titel}
                        {v.passt ? '' : ' (anderer Beruf)'}
                      </option>
                    ))}
                  </select>
                  <label className="baustein-ab">
                    ab der Woche vom
                    <input type="date" value={bausteinAb || bausteinVorschlag} min={d.beginn ?? undefined} max={d.ende ?? undefined} onChange={(e) => setBausteinAb(e.target.value)} />
                  </label>
                  <button type="button" className="knopf schlicht" disabled={!vorlage} onClick={() => void uebernimm()}>
                    Baustein einfügen
                  </button>
                  <Link zu="/planung/bausteine" className="klein">
                    Bausteine verwalten
                  </Link>
                </div>
              )}
              {d.vorlagen.length === 0 && d.rechte.zuweisen && (
                <p className="leise klein nicht-drucken">
                  Was immer wieder vorkommt, lässt sich als <Link zu="/planung/bausteine">Planbaustein</Link> anlegen und hier ab einer Woche deiner Wahl einfügen.
                </p>
              )}

              <div className="plan-legende leise klein" aria-label="Legende">
                {legende}
              </div>
              {zeigeFrei && !d.ferienVorhanden && !d.beginnFehlt && <p className="leise klein">Für das Bundesland der Berufsschule sind keine Schulferien hinterlegt.</p>}

              {[...jahre.entries()].map(([jahr, ws]) => {
                const liste = nurBelegt ? ws.filter(istBelegt) : ws;
                return (
                  <section key={jahr} className="karte plan-jahr" aria-labelledby={`jahr-${jahr}-titel`}>
                    <div className="plan-jahr-kopf">
                      <h2 id={`jahr-${jahr}-titel`}>{jahrTitel(jahr)}</h2>
                      <span className="leise klein">
                        {datum(ws[0].montag)} – {datum(ws[ws.length - 1].sonntag)} · {ws.length} {ws.length === 1 ? 'Woche' : 'Wochen'} · {ws.filter((w) => schule.has(w.montag)).length} in der Schule
                      </span>
                    </div>
                    {liste.length === 0 ? (
                      <p className="leise klein plan-leer">In diesem Jahr ist noch nichts eingetragen.</p>
                    ) : (
                      <ol className="kw-liste">
                        {liste.map((w, i) => {
                          const monat = monatDerWoche(w);
                          const neuerMonat = i === 0 || monatDerWoche(liste[i - 1]) !== monat;
                          const aktuell = w.montag === dieseWoche;
                          const status = berichtStatus.get(w.montag);
                          return (
                            <Fragment key={w.montag}>
                              {neuerMonat && (
                                <li aria-hidden="true" className="kw-monat ueberschrift-klein">
                                  {monat}
                                </li>
                              )}
                              <li id={`kw-${w.montag}`} aria-current={aktuell ? 'date' : undefined} className={`kw${aktuell ? ' heute' : ''}${schule.has(w.montag) ? ' schule' : ''}`}>
                                <div className={`kw-kopf${dieseWoche && w.montag < dieseWoche ? ' vergangen' : ''}`}>
                                  <strong>
                                    KW {w.kw}
                                    {schule.has(w.montag) && <span className="nur-vorleser"> (Schulwoche)</span>}
                                  </strong>
                                  <span className="leise klein">
                                    {tagMonat(w.montag)}–{tagMonat(w.sonntag)}
                                  </span>
                                  {aktuell && <span className="pille voll">Diese Woche</span>}
                                </div>
                                <div className="kw-aktionen nicht-drucken">
                                  {status && (status !== 'fehlt' || d.eigenes) && <BerichtLink basis={basis} montag={w.montag} status={status} eigenes={d.eigenes} />}
                                  {plant && (
                                    <button type="button" className="plus" onClick={() => oeffne(neu(w))} aria-label={`Eintrag in KW ${w.kw} hinzufügen`} title="Eintrag hinzufügen">
                                      +
                                    </button>
                                  )}
                                </div>
                                <div className="kw-inhalt">
                                  <WochenInhalt woche={w} daten={d} frei={zeigeFrei} a={a} />
                                </div>
                              </li>
                            </Fragment>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                );
              })}
              <p className="leise klein">
                Stand {datum(d.heute)} · {d.eintraege.length} Einträge im ganzen Plan
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
