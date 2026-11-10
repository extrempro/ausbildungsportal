import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { FormEvent } from 'react';
import { api, ART_FARBE, ART_TEXT, berichtsheftPfad, datum, plusTage, ROLLE_TEXT, STATUS_FARBE, STATUS_TEXT } from '../api';
import type { BerichtListe, BerichtStatus, PlanAntwort, PlanArt, PlanEintrag, PlanWoche, Unteraufgabe } from '../api';
import { Link } from '../router';

interface Entwurf {
  id: number | null;
  art: PlanArt;
  titel: string;
  von: string;
  bis: string;
  text: string;
  zustaendigId: number | null;
  zuweisen: boolean;
  erledigt: boolean;
  unteraufgaben: Unteraufgabe[];
}

const REIHENFOLGE: PlanArt[] = ['schule', 'einsatz', 'aufgabe', 'notiz'];

function EintragFormular({ daten, start, onFertig, onAbbruch }: { daten: PlanAntwort; start: Entwurf; onFertig: (text: string) => Promise<void>; onAbbruch: () => void }) {
  const [e, setE] = useState<Entwurf>(start);
  const [fehler, setFehler] = useState('');
  const basis = `/api/azubis/${daten.azubi.id}/plan`;
  const setze = (teil: Partial<Entwurf>) => setE((alt) => ({ ...alt, ...teil }));
  const mitPerson = e.art === 'einsatz' || e.art === 'aufgabe';
  const person = daten.personen.find((p) => p.id === e.zustaendigId);
  const kannZuweisen = daten.rechte.zuweisen && e.art === 'einsatz' && person?.rolle === 'beauftragter';

  // Escape schließt den Dialog
  useEffect(() => {
    const taste = (ev: KeyboardEvent) => ev.key === 'Escape' && onAbbruch();
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onAbbruch]);

  const sende = async (ev: FormEvent) => {
    ev.preventDefault();
    const body = {
      art: e.art,
      titel: e.titel,
      von: e.von,
      bis: e.bis || e.von,
      text: e.text,
      zustaendigId: mitPerson ? e.zustaendigId : null,
      zuweisen: kannZuweisen && e.zuweisen,
      erledigt: e.erledigt,
      unteraufgaben: e.unteraufgaben,
    };
    try {
      const r = e.id === null ? await api<{ zugewiesen: boolean }>('POST', basis, body) : await api<{ zugewiesen: boolean }>('PUT', `${basis}/${e.id}`, body);
      await onFertig(`Eintrag gespeichert.${r.zugewiesen ? ` ${person?.anzeigename} ist dem Azubi für diesen Zeitraum zugewiesen.` : ''}`);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };
  const loesche = async () => {
    if (e.id === null || !window.confirm(`„${e.titel}“ aus dem Plan löschen?`)) return;
    try {
      await api('DELETE', `${basis}/${e.id}`);
      await onFertig('Eintrag gelöscht.');
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <div className="dialog-hintergrund" onMouseDown={(ev) => ev.target === ev.currentTarget && onAbbruch()}>
    <section className="karte dialog" id="plan-formular" role="dialog" aria-modal="true" aria-labelledby="plan-formular-titel">
      <h2 id="plan-formular-titel">{e.id === null ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>
      <form className="reihe" onSubmit={(ev) => void sende(ev)}>
        <label>
          Art
          <select value={e.art} onChange={(ev) => setze({ art: ev.target.value as PlanArt })}>
            {daten.rechte.arten.map((a) => (
              <option key={a} value={a}>
                {ART_TEXT[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="ganz">
          Titel
          <input value={e.titel} maxLength={120} required autoFocus onChange={(ev) => setze({ titel: ev.target.value })} placeholder={e.art === 'einsatz' ? 'z. B. IT-Support' : e.art === 'schule' ? 'z. B. Blockunterricht' : ''} />
        </label>
        <label>
          Von (Woche mit diesem Tag)
          <input type="date" value={e.von} required onChange={(ev) => setze({ von: ev.target.value })} />
        </label>
        <label>
          Bis (leer = eine Woche)
          <input type="date" value={e.bis} min={e.von} onChange={(ev) => setze({ bis: ev.target.value })} />
        </label>
        {mitPerson && (
          <label>
            Zuständig
            <select value={e.zustaendigId ?? ''} onChange={(ev) => setze({ zustaendigId: ev.target.value ? Number(ev.target.value) : null })}>
              <option value="">– niemand –</option>
              {daten.personen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.anzeigename} ({ROLLE_TEXT[p.rolle]})
                </option>
              ))}
            </select>
          </label>
        )}
        {kannZuweisen && (
          <label className="haken ganz">
            <input type="checkbox" checked={e.zuweisen} onChange={(ev) => setze({ zuweisen: ev.target.checked })} />
            {person?.anzeigename} dem Azubi für diesen Zeitraum zuweisen (darf dann Berichte dieser Wochen abzeichnen)
          </label>
        )}
        <label className="ganz">
          Beschreibung
          <textarea rows={3} maxLength={2000} value={e.text} onChange={(ev) => setze({ text: ev.target.value })} />
        </label>
        {e.art === 'aufgabe' && (
          <div className="ganz">
            <strong className="klein">Unteraufgaben</strong>
            {e.unteraufgaben.map((u, i) => (
              <div className="zeile zwei" key={i}>
                <input aria-label={`Unteraufgabe ${i + 1}`} value={u.text} maxLength={200} onChange={(ev) => setze({ unteraufgaben: e.unteraufgaben.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)) })} />
                <button type="button" className="knopf schlicht" onClick={() => setze({ unteraufgaben: e.unteraufgaben.filter((_, j) => j !== i) })}>
                  Entfernen
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="knopf schlicht" disabled={e.unteraufgaben.length >= 30} onClick={() => setze({ unteraufgaben: [...e.unteraufgaben, { text: '', erledigt: false }] })}>
                Unteraufgabe hinzufügen
              </button>
            </div>
          </div>
        )}
        {fehler && (
          <p className="hinweis fehler ganz" role="alert">
            {fehler}
          </p>
        )}
        <div className="aktionen links ganz">
          <button className="knopf">Speichern</button>
          <button type="button" className="knopf schlicht" onClick={onAbbruch}>
            Abbrechen
          </button>
          {e.id !== null && (
            <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
              Löschen
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
      const grenze = (document.querySelector('.leiste')?.getBoundingClientRect().height ?? 108) + 40;
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
  darf: (e: PlanEintrag) => boolean;
  bearbeite: (e: PlanEintrag) => void;
  hake: (e: PlanEintrag, body: { erledigt: boolean; unteraufgabe?: number }) => void;
}

/** Einträge, Ferien und Feiertage einer Woche. `voll` zeigt Beschreibung und Unteraufgaben immer (Karten oben). */
function WochenInhalt({ woche, daten, frei, voll, leer, a }: { woche: Woche; daten: PlanAntwort; frei: boolean; voll?: boolean; leer?: string; a: Aktionen }) {
  const eintraege = daten.eintraege.filter((e) => e.von <= woche.montag && e.bis >= woche.montag).sort((x, y) => REIHENFOLGE.indexOf(x.art) - REIHENFOLGE.indexOf(y.art) || x.von.localeCompare(y.von) || x.id - y.id);
  const ferien = frei ? daten.ferien.filter((f) => f.von <= woche.sonntag && f.bis >= woche.montag) : [];
  const feiertage = frei ? daten.feiertage.filter((f) => f.datum >= woche.montag && f.datum <= woche.sonntag) : [];
  const marken = [d2(daten.beginn, woche) && `Ausbildungsbeginn · ${tagMonat(daten.beginn!)}`, d2(daten.ende, woche) && `Ende der Ausbildung · ${tagMonat(daten.ende!)}`].filter(Boolean);
  if (!eintraege.length && !ferien.length && !feiertage.length && !marken.length) return leer ? <p className="leise klein">{leer}</p> : null;
  return (
    <>
      {marken.map((m) => (
        <div className="plan-kopf plan-eintrag" key={String(m)}>
          <span className="pille gruen"><strong>{m}</strong></span>
        </div>
      ))}
      {eintraege.map((e) => {
        const erste = voll || e.von === woche.montag;
        const wochen = Math.round((Date.parse(e.bis) - Date.parse(e.von)) / 604800000) + 1;
        const nr = Math.round((Date.parse(woche.montag) - Date.parse(e.von)) / 604800000) + 1;
        return (
          <div key={e.id} className="plan-eintrag">
            <div className="plan-kopf">
              {e.art === 'aufgabe' && <input type="checkbox" aria-label={`„${e.titel}“ erledigt`} checked={e.erledigt} onChange={(ev) => a.hake(e, { erledigt: ev.target.checked })} />}
              <span className={`pille ${ART_FARBE[e.art]}`}>{ART_TEXT[e.art]}</span>
              {a.darf(e) ? (
                <button type="button" className={`link-knopf${e.erledigt ? ' erledigt' : ''}`} onClick={() => a.bearbeite(e)} title="Eintrag bearbeiten">
                  {e.titel}
                </button>
              ) : (
                <span className={e.erledigt ? 'erledigt' : undefined}>{e.titel}</span>
              )}
              {wochen > 1 && (
                <span className="leise klein">
                  Woche {nr} von {wochen}
                </span>
              )}
              {e.zustaendig && <span className="leise klein">· {e.zustaendig}</span>}
            </div>
            {erste && e.text && <div className="plan-text leise klein mehrzeilig">{e.text}</div>}
            {erste && e.unteraufgaben.length > 0 && (
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
      })}
      {ferien.map((f) => (
        <div className="plan-kopf plan-eintrag" key={f.name + f.von}>
          <span className="pille ferien">Schulferien</span>
          <span className="leise">
            {f.name} <span className="klein">({tagMonat(f.von)}–{tagMonat(f.bis)})</span>
          </span>
        </div>
      ))}
      {feiertage.map((f) => (
        <div className="plan-kopf plan-eintrag" key={f.datum}>
          <span className="pille umrandet">Feiertag</span>
          <span className="leise">
            {f.name} <span className="klein">({tagMonat(f.datum)})</span>
          </span>
        </div>
      ))}
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
  onNeu: (w: Woche) => void;
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
function Jahresband({ wochen, schule, ferien, heute, gelesen, onSpringe }: { wochen: Woche[]; schule: Set<string>; ferien: Set<string>; heute?: string; gelesen?: string; onSpringe: (montag: string) => void }) {
  const schulAnzahl = wochen.filter((w) => schule.has(w.montag)).length;
  return (
    <div role="img" aria-label={`${wochen.length} Wochen, davon ${schulAnzahl} Schulwochen`} className="jahresband">
      {wochen.map((w) => (
        <span
          key={w.montag}
          title={`KW ${w.kw} · ${tagMonat(w.montag)}–${tagMonat(w.sonntag)}`}
          onClick={() => onSpringe(w.montag)}
          className={`${w.montag === heute ? 'heute' : schule.has(w.montag) ? 'schule' : ferien.has(w.montag) ? 'ferien' : ''}${w.montag === gelesen ? ' gelesen' : ''}`}
        />
      ))}
    </div>
  );
}

/** Seitenleiste: wo man gerade liest, Fortschritt der Ausbildung und je Jahr ein Band aller Wochen. */
function PlanKompass({ jahre, gelesen, heute, gesamt, schule, ferien, onSpringe }: { jahre: Map<number, Woche[]>; gelesen: Woche | null; heute: Woche | null; gesamt: number; schule: Set<string>; ferien: Set<string>; onSpringe: (montag: string) => void }) {
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
              <Jahresband wochen={ws} schule={schule} ferien={ferien} heute={heute?.montag} gelesen={ort?.montag} onSpringe={onSpringe} />
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
            </li>
          );
        })}
      </ol>

      <div className="kompass-teil kompass-legende leise klein" aria-hidden="true">
        <span>
          <i className="schule" /> Schule
        </span>
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

  const istBelegt = (w: Woche) => !!d && (w.montag <= d.heute && w.sonntag >= d.heute ? true : w.nummer === 1 || d2(d.ende, w) || d.eintraege.some((e) => e.von <= w.montag && e.bis >= w.montag));
  const sichtbar = nurBelegt ? wochen.filter(istBelegt) : wochen;
  const gelesenId = useAktiverAbschnitt(sichtbar.map((w) => `kw-${w.montag}`));

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
  const dieseWoche = aktuelle?.montag ?? '';
  const naechste = aktuelle ? (wochen.find((w) => w.montag === plusTage(aktuelle.montag, 7)) ?? null) : null;
  const gesamt = wochen.filter((w) => w.nummer > 0).length;
  const gelesen = sichtbar.find((w) => `kw-${w.montag}` === gelesenId) ?? null;
  const plant = d.rechte.arten.length > 0;
  const basis = berichtsheftPfad(azubiId, d.eigenes);
  const berichtStatus = new Map((berichte?.wochen ?? []).map((w) => [w.montag, w.status]));

  const jahre = new Map<number, Woche[]>();
  for (const w of wochen) jahre.set(w.ausbildungsjahr ?? 0, [...(jahre.get(w.ausbildungsjahr ?? 0) ?? []), w]);

  const offen = d.eintraege.filter((e) => e.art === 'aufgabe' && !e.erledigt);
  const ueberfaellig = offen.filter((e) => dieseWoche && e.bis < dieseWoche);
  const faellig = (berichte?.wochen ?? []).filter((w) => dieseWoche && w.montag < dieseWoche);
  const fehlend = faellig.filter((w) => w.status === 'fehlt');
  const rest = aktuelle && aktuelle.nummer ? gesamt - aktuelle.nummer : null;

  const neu = (w: Woche | null): Entwurf => ({ id: null, art: d.rechte.arten.includes('einsatz') ? 'einsatz' : 'aufgabe', titel: '', von: w?.montag ?? d.heute, bis: '', text: '', zustaendigId: null, zuweisen: true, erledigt: false, unteraufgaben: [] });
  const oeffne = (e: Entwurf) => {
    setMeldung(null);
    setEntwurf(e);
  };
  const zeige = (montag: string) => {
    if (nurBelegt && !document.getElementById(`kw-${montag}`)) setNurBelegt(false);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`kw-${montag}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
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
    darf: (e) => d.rechte.arten.includes(e.art),
    bearbeite: (e) => oeffne({ id: e.id, art: e.art, titel: e.titel, von: e.von, bis: e.bis === e.von ? '' : plusTage(e.bis, 6), text: e.text, zustaendigId: e.zustaendigId, zuweisen: false, erledigt: e.erledigt, unteraufgaben: e.unteraufgaben }),
    hake: (e, body) => void hake(e, body),
  };
  const uebernimm = async () => {
    const v = d.vorlagen.find((x) => String(x.id) === vorlage);
    if (!v || !window.confirm(`Vorlage „${v.titel}“ in diesen Plan übernehmen? Die Einträge kommen zu den vorhandenen dazu.`)) return;
    try {
      const r = await api<{ uebernommen: number }>('POST', `/api/azubis/${azubiId}/plan/vorlage`, { vorlageId: v.id });
      await lade();
      setMeldung({ text: `${r.uebernommen} Einträge aus der Vorlage übernommen.`, fehler: false });
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <>
      {!d.eigenes && (
        <p className="klein nicht-drucken">
          <Link zu={`/azubis/${azubiId}`}>← {d.azubi.anzeigename}</Link>
        </p>
      )}
      <h1>Ausbildungsplan{d.eigenes ? '' : ` von ${d.azubi.anzeigename}`}</h1>
      <p className="leise">
        {d.beruf ? `${d.beruf} · ` : ''}
        {d.eigenes
          ? 'Deine Ausbildung Woche für Woche – Schulblöcke, Einsätze, Aufgaben und Notizen. Aufgaben kannst du abhaken.'
          : d.rechte.arten.includes('einsatz')
            ? 'Die Ausbildung Woche für Woche – Schulblöcke, Einsätze, Aufgaben und Notizen. Zum Ändern den Titel eines Eintrags anklicken.'
            : plant
              ? 'Du kannst Aufgaben und Notizen anlegen; Schulblöcke und Einsätze plant der Ausbilder.'
              : 'Nur zur Ansicht.'}
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
            setMeldung({ text, fehler: false });
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
              onNeu={(w) => oeffne(neu(w))}
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
              onNeu={(w) => oeffne(neu(w))}
              onZeigen={zeige}
              a={a}
            />
            <div className="karte kennzahlen">
              <Kennzahl wert={rest ?? '–'} einheit={rest === null ? '' : rest === 1 ? 'Woche' : 'Wochen'} text={rest === null ? 'Die laufende Woche liegt außerhalb der Ausbildung' : `bis zum Ende der Ausbildung (${datum(d.ende)})`} />
              {berichte && !berichte.beginnFehlt && (
                <Kennzahl wert={fehlend.length} einheit={fehlend.length === 1 ? 'Bericht fehlt' : 'Berichte fehlen'} text={`${faellig.length - fehlend.length} von ${faellig.length} fälligen Wochen geschrieben`} warnung={fehlend.length > 0}>
                  <Link zu={basis} className="klein">
                    Zum Berichtsheft
                  </Link>
                </Kennzahl>
              )}
              <Kennzahl wert={offen.length} einheit={offen.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'} text={ueberfaellig.length ? `davon ${ueberfaellig.length} überfällig` : 'nichts überfällig'} warnung={ueberfaellig.length > 0} />
            </div>
          </section>

          <div className="plan-bereich">
            <aside className="karte plan-seite nicht-drucken">
              <PlanKompass jahre={jahre} gelesen={gelesen} heute={aktuelle} gesamt={gesamt} schule={schule} ferien={ferienWochen} onSpringe={zeige} />
            </aside>

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
              {/* Auf kleinen Bildschirmen ersetzt das die Seitenleiste */}
              <nav aria-label="Zum Ausbildungsjahr springen" className="filter jahr-sprung nicht-drucken">
                {[...jahre.entries()].map(([j, ws]) => (
                  <button key={j} type="button" className="link-knopf" onClick={() => zeige(ws[0].montag)}>
                    {j === 0 ? 'Außerhalb' : `${j}. Jahr`}
                  </button>
                ))}
                {aktuelle && (
                  <button type="button" className="link-knopf" onClick={() => zeige(aktuelle.montag)}>
                    Diese Woche
                  </button>
                )}
              </nav>

              {d.vorlagen.length > 0 && !d.beginnFehlt && (
                <div className="filter nicht-drucken">
                  <select aria-label="Planvorlage" value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
                    <option value="">– Vorlage wählen –</option>
                    {d.vorlagen.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titel}
                        {v.passt ? '' : ' (anderer Beruf)'}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="knopf schlicht" disabled={!vorlage} onClick={() => void uebernimm()}>
                    Vorlage übernehmen
                  </button>
                  <Link zu="/verwaltung/vorlagen" className="klein">
                    Vorlagen verwalten
                  </Link>
                </div>
              )}
              {d.vorlagen.length === 0 && d.rechte.zuweisen && (
                <p className="leise klein nicht-drucken">
                  Wiederkehrende Abläufe lassen sich als <Link zu="/verwaltung/vorlagen">Planvorlage</Link> anlegen und hier übernehmen.
                </p>
              )}

              <div className="plan-legende leise klein" aria-label="Legende">
                <span>
                  <i className="streifen" /> Schulwoche
                </span>
                {REIHENFOLGE.map((art) => (
                  <span key={art} className={`pille ${ART_FARBE[art]}`}>
                    {ART_TEXT[art]}
                  </span>
                ))}
                {zeigeFrei && <span className="pille ferien">Schulferien</span>}
                {zeigeFrei && <span className="pille umrandet">Feiertag</span>}
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
