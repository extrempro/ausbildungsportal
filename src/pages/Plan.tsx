import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ART_FARBE, ART_TEXT, datum, plusTage, ROLLE_TEXT, wocheText } from '../api';
import type { PlanAntwort, PlanArt, PlanEintrag, PlanWoche, Unteraufgabe } from '../api';
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
    <section className="karte" id="plan-formular">
      <h2>{e.id === null ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>
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
          <input value={e.titel} maxLength={120} required onChange={(ev) => setze({ titel: ev.target.value })} placeholder={e.art === 'einsatz' ? 'z. B. IT-Support' : e.art === 'schule' ? 'z. B. Blockunterricht' : ''} />
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
  );
}

/** Ausbildungsplan eines Azubis: eine Zeile je Kalenderwoche. */
export function PlanSeite({ azubiId }: { azubiId: number }) {
  const [d, setD] = useState<PlanAntwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [jahr, setJahr] = useState<number | 'alle' | null>(null);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [vorlage, setVorlage] = useState('');
  const gesprungen = useRef(false);

  const lade = useCallback(async () => {
    setD(await api<PlanAntwort>('GET', `/api/azubis/${azubiId}/plan`));
  }, [azubiId]);
  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
  }, [lade]);

  const laufende = d ? [...d.wochen].reverse().find((w) => w.montag <= d.heute && plusTage(w.montag, 6) >= d.heute) : undefined;
  const jahre = d ? [...new Set(d.wochen.map((w) => w.ausbildungsjahr).filter((j): j is number => j !== null))] : [];
  const gewaehlt = jahr ?? laufende?.ausbildungsjahr ?? jahre[0] ?? 'alle';

  // beim ersten Öffnen zur laufenden Woche springen
  useEffect(() => {
    if (!d || gesprungen.current) return;
    gesprungen.current = true;
    if (laufende) document.getElementById(`woche-${laufende.montag}`)?.scrollIntoView({ block: 'center' });
  }, [d, laufende]);

  if (fehler) {
    return (
      <>
        <h1>Ausbildungsplan nicht gefunden</h1>
        <p className="leise">{fehler}</p>
      </>
    );
  }
  if (!d) return <p className="leise">Lädt …</p>;

  const plant = d.rechte.arten.length > 0;
  const darf = (e: PlanEintrag) => d.rechte.arten.includes(e.art);
  const neu = (montag: string): Entwurf => ({ id: null, art: d.rechte.arten.includes('einsatz') ? 'einsatz' : 'aufgabe', titel: '', von: montag, bis: '', text: '', zustaendigId: null, zuweisen: true, erledigt: false, unteraufgaben: [] });
  const oeffne = (e: Entwurf) => {
    setMeldung(null);
    setEntwurf(e);
    queueMicrotask(() => document.getElementById('plan-formular')?.scrollIntoView({ block: 'start' }));
  };
  const bearbeite = (e: PlanEintrag) => oeffne({ id: e.id, art: e.art, titel: e.titel, von: e.von, bis: e.bis === e.von ? '' : plusTage(e.bis, 6), text: e.text, zustaendigId: e.zustaendigId, zuweisen: false, erledigt: e.erledigt, unteraufgaben: e.unteraufgaben });

  const hake = async (e: PlanEintrag, body: { erledigt: boolean; unteraufgabe?: number }) => {
    const ersetze = (neu: PlanEintrag) => setD((alt) => (alt ? { ...alt, eintraege: alt.eintraege.map((x) => (x.id === e.id ? neu : x)) } : alt));
    // sofort anzeigen, dann mit der Antwort des Servers abgleichen
    ersetze(body.unteraufgabe === undefined ? { ...e, erledigt: body.erledigt } : { ...e, unteraufgaben: e.unteraufgaben.map((u, i) => (i === body.unteraufgabe ? { ...u, erledigt: body.erledigt } : u)) });
    try {
      ersetze((await api<{ eintrag: PlanEintrag }>('POST', `/api/azubis/${azubiId}/plan/${e.id}/haken`, body)).eintrag);
    } catch (err) {
      ersetze(e);
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
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

  const sichtbar = d.wochen.filter((w) => gewaehlt === 'alle' || w.ausbildungsjahr === gewaehlt);
  const zeile = (w: PlanWoche) => {
    const sonntag = plusTage(w.montag, 6);
    const eintraege = d.eintraege.filter((e) => e.von <= w.montag && e.bis >= w.montag).sort((a, b) => REIHENFOLGE.indexOf(a.art) - REIHENFOLGE.indexOf(b.art));
    const ferien = d.ferien.filter((f) => f.von <= sonntag && f.bis >= w.montag);
    const feiertage = d.feiertage.filter((f) => f.datum >= w.montag && f.datum <= sonntag);
    const heute = laufende?.montag === w.montag;
    return (
      <tr key={w.montag} id={`woche-${w.montag}`} className={heute ? 'heute' : undefined}>
        <td className="woche">
          <strong>
            KW {w.kw}/{w.jahr}
          </strong>
          {heute && <span className="pille blau">diese Woche</span>}
          <div className="leise klein">{wocheText(w.montag, sonntag)}</div>
          {ferien.map((f) => (
            <div className="leise klein" key={f.name + f.von}>
              {f.name}
            </div>
          ))}
          {feiertage.map((f) => (
            <div className="leise klein" key={f.datum}>
              {f.datum.slice(8, 10)}.{f.datum.slice(5, 7)}. {f.name}
            </div>
          ))}
        </td>
        <td>
          {eintraege.map((e) => {
            const erste = e.von === w.montag || sichtbar[0]?.montag === w.montag;
            const wochen = Math.round((Date.parse(e.bis) - Date.parse(e.von)) / 604800000) + 1;
            const nr = Math.round((Date.parse(w.montag) - Date.parse(e.von)) / 604800000) + 1;
            return (
              <div key={e.id} className="plan-eintrag">
                <div className="plan-kopf">
                  {e.art === 'aufgabe' && <input type="checkbox" aria-label={`„${e.titel}“ erledigt`} checked={e.erledigt} onChange={(ev) => void hake(e, { erledigt: ev.target.checked })} />}
                  <span className={`pille ${ART_FARBE[e.art]}`}>{ART_TEXT[e.art]}</span>
                  {darf(e) ? (
                    <button type="button" className={`link-knopf${e.erledigt ? ' erledigt' : ''}`} onClick={() => bearbeite(e)} title="Eintrag bearbeiten">
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
                          <input type="checkbox" checked={u.erledigt} onChange={(ev) => void hake(e, { unteraufgabe: i, erledigt: ev.target.checked })} />
                          <span className={u.erledigt ? 'erledigt' : undefined}>{u.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {plant && (
            <button type="button" className="link-knopf leise klein nicht-drucken" onClick={() => oeffne(neu(w.montag))}>
              + Eintrag
            </button>
          )}
        </td>
      </tr>
    );
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
          ? 'Schulblöcke, Einsätze und Aufgaben deiner Ausbildung. Aufgaben kannst du abhaken; geplant wird von Ausbilder und Ausbildungsbeauftragten.'
          : d.rechte.arten.includes('einsatz')
            ? 'Schulblöcke, Einsätze, Aufgaben und Notizen je Kalenderwoche. Zum Ändern den Titel eines Eintrags anklicken.'
            : plant
              ? 'Du kannst Aufgaben und Notizen anlegen; Schulblöcke und Einsätze plant der Ausbilder.'
              : 'Nur zur Ansicht.'}
      </p>

      {d.beginnFehlt && (
        <p className="hinweis">
          {d.eigenes ? 'Für dich ist noch kein Ausbildungsbeginn eingetragen. Bitte wende dich an deinen Ausbilder.' : 'Für diesen Azubi ist noch kein Ausbildungsbeginn eingetragen. Er steht im Profil – erst dann gibt es Wochen zum Planen.'}
        </p>
      )}
      {!d.ferienVorhanden && !d.beginnFehlt && plant && <p className="leise klein">Für das Bundesland der Berufsschule sind keine Schulferien hinterlegt.</p>}
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
          onAbbruch={() => setEntwurf(null)}
          onFertig={async (text) => {
            await lade();
            setEntwurf(null);
            setMeldung({ text, fehler: false });
          }}
        />
      )}

      {d.wochen.length > 0 && (
        <>
          <div className="filter nicht-drucken" role="group" aria-label="Ausbildungsjahr">
            {jahre.map((j) => (
              <button key={j} type="button" className="knopf schlicht" aria-pressed={gewaehlt === j} onClick={() => setJahr(j)}>
                {j}. Jahr
              </button>
            ))}
            <button type="button" className="knopf schlicht" aria-pressed={gewaehlt === 'alle'} onClick={() => setJahr('alle')}>
              Alle
            </button>
            {plant && !entwurf && (
              <button type="button" className="knopf rechts" onClick={() => oeffne(neu(laufende?.montag ?? sichtbar[0]?.montag ?? d.heute))}>
                Eintrag hinzufügen
              </button>
            )}
          </div>
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
          <div className="karte tabelle-rahmen">
            <table className="plan">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Geplant</th>
                </tr>
              </thead>
              <tbody>{sichtbar.map(zeile)}</tbody>
            </table>
          </div>
          <p className="leise klein">
            Stand {datum(d.heute)} · {d.eintraege.length} Einträge im ganzen Plan
          </p>
        </>
      )}
    </>
  );
}
