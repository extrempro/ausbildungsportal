import { useCallback, useEffect, useState } from 'react';
import { api, ApiFehler, berichtsheftPfad, datum, GRUND_TEXT, h, ROLLE_TEXT, STATUS_FARBE, STATUS_TEXT, wocheText, zeit } from '../api';
import type { Bericht, BerichtAbwesenheit, BerichtEintrag, BerichtInhalt, Grund } from '../api';
import { geheZu, Link } from '../router';
import { UnterschriftBild } from '../unterschrift';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const ABSCHNITTE: { schluessel: 'betrieb' | 'unterweisung' | 'schule'; titel: string; hilfe: string }[] = [
  { schluessel: 'betrieb', titel: 'Betriebliche Tätigkeiten', hilfe: 'Was hast du im Betrieb gemacht?' },
  { schluessel: 'unterweisung', titel: 'Unterweisungen und Schulungen', hilfe: 'z. B. Einweisungen, betrieblicher Unterricht, Lehrgänge' },
  { schluessel: 'schule', titel: 'Berufsschule', hilfe: 'Themen des Unterrichts' },
];
const VERLAUF_TEXT: Record<string, string> = {
  eingereicht: 'eingereicht',
  zurueckgezogen: 'zurückgezogen',
  zurueckgegeben: 'zurückgegeben',
  abgezeichnet: 'abgezeichnet',
  abzeichnung_aufgehoben: 'Abzeichnung aufgehoben',
};

function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function summeVon(i: BerichtInhalt): number {
  const s = (l: { stunden: number }[]) => l.reduce((n, x) => n + (Number(x.stunden) || 0), 0);
  return s(i.betrieb) + s(i.unterweisung) + s(i.schule) + s(i.abwesenheit);
}

/** Der Nachweis zum Lesen und Drucken: Kopf, Inhalte, Summe, Unterschriften. */
export function BerichtBlatt({ b }: { b: Bericht }) {
  const azubi = b.signaturen.find((s) => s.art === 'azubi');
  const abzeichnung = b.signaturen.find((s) => s.art === 'abzeichnung');
  return (
    <article className="blatt">
      <header className="blatt-kopf">
        <div>
          <strong>Ausbildungsnachweis</strong> · Woche {b.kw}/{b.jahr} · {wocheText(b.montag, b.sonntag)}
          {b.ausbildungsjahr ? ` · ${b.ausbildungsjahr}. Ausbildungsjahr` : ''}
        </div>
        <div className="leise klein">
          {[b.kopf.azubi, b.kopf.beruf, b.kopf.betrieb].filter(Boolean).join(' · ')}
          {b.kopf.ausbilder ? ` · Ausbilder: ${b.kopf.ausbilder}` : ''}
        </div>
      </header>

      {ABSCHNITTE.map((a) => (
        <section key={a.schluessel}>
          <h3>{a.titel}</h3>
          {b.inhalt[a.schluessel].length === 0 ? (
            <p className="leise">–</p>
          ) : (
            <table className="blatt-tabelle">
              <tbody>
                {b.inhalt[a.schluessel].map((e, i) => (
                  <tr key={i}>
                    <td className="mehrzeilig">{e.text}</td>
                    <td className="zahl">{h(e.stunden)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      <section>
        <h3>Abwesenheit</h3>
        {b.inhalt.abwesenheit.length === 0 ? (
          <p className="leise">–</p>
        ) : (
          <table className="blatt-tabelle">
            <tbody>
              {b.inhalt.abwesenheit.map((a, i) => (
                <tr key={i}>
                  <td>
                    {datum(a.tag)} · {GRUND_TEXT[a.grund]}
                    {a.text ? ` (${a.text})` : ''}
                  </td>
                  <td className="zahl">{h(a.stunden)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="blatt-summe">
        <strong>Summe: {h(b.summe.gesamt)} Stunden</strong> <span className="leise">(Soll {h(b.soll)})</span>
      </p>

      <div className="signaturen">
        {[
          { titel: 'Auszubildende/r', s: azubi },
          { titel: 'Ausbilder/in bzw. Ausbildungsbeauftragte/r', s: abzeichnung },
        ].map(({ titel, s }) => (
          <div key={titel} className="signatur">
            <div className="signatur-feld">{s && <UnterschriftBild pfad={s.pfad} titel={`Unterschrift von ${s.name}`} />}</div>
            <div className="klein">
              {s ? `${s.name}, ${datum(s.zeit)}` : ' '}
              <br />
              <span className="leise">{titel}</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function EintragListe({ titel, hilfe, liste, onAendern }: { titel: string; hilfe: string; liste: BerichtEintrag[]; onAendern: (l: BerichtEintrag[]) => void }) {
  const setze = (i: number, teil: Partial<BerichtEintrag>) => onAendern(liste.map((e, j) => (j === i ? { ...e, ...teil } : e)));
  return (
    <fieldset className="abschnitt">
      <legend>{titel}</legend>
      {liste.map((e, i) => (
        <div className="zeile" key={i}>
          <label className="breit">
            <span className="nur-vorleser">
              {titel}, Zeile {i + 1}
            </span>
            <textarea rows={2} value={e.text} maxLength={2000} placeholder={hilfe} onChange={(ev) => setze(i, { text: ev.target.value })} />
          </label>
          <label>
            <span className="nur-vorleser">Stunden</span>
            <input type="number" min={0} max={60} step={0.25} value={e.stunden} aria-label={`Stunden, ${titel}, Zeile ${i + 1}`} onChange={(ev) => setze(i, { stunden: Number(ev.target.value) })} />
          </label>
          <button type="button" className="knopf schlicht" aria-label={`Zeile ${i + 1} entfernen`} onClick={() => onAendern(liste.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      <button type="button" className="knopf schlicht" onClick={() => onAendern([...liste, { text: '', stunden: 0 }])}>
        Zeile hinzufügen
      </button>
    </fieldset>
  );
}

function AbwesenheitListe({ montag, tagSoll, liste, onAendern }: { montag: string; tagSoll: number; liste: BerichtAbwesenheit[]; onAendern: (l: BerichtAbwesenheit[]) => void }) {
  const setze = (i: number, teil: Partial<BerichtAbwesenheit>) => onAendern(liste.map((e, j) => (j === i ? { ...e, ...teil } : e)));
  return (
    <fieldset className="abschnitt">
      <legend>Abwesenheit</legend>
      {liste.map((a, i) => (
        <div className="zeile vier" key={i}>
          <label>
            Tag
            <select value={a.tag} onChange={(ev) => setze(i, { tag: ev.target.value })}>
              {TAGE.map((name, t) => (
                <option key={t} value={plusTage(montag, t)}>
                  {name}, {datum(plusTage(montag, t))}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grund
            <select value={a.grund} onChange={(ev) => setze(i, { grund: ev.target.value as Grund })}>
              {(Object.keys(GRUND_TEXT) as Grund[]).map((g) => (
                <option key={g} value={g}>
                  {GRUND_TEXT[g]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stunden
            <input type="number" min={0} max={24} step={0.25} value={a.stunden} onChange={(ev) => setze(i, { stunden: Number(ev.target.value) })} />
          </label>
          <label>
            Hinweis (freiwillig)
            <input value={a.text} maxLength={200} onChange={(ev) => setze(i, { text: ev.target.value })} />
          </label>
          <button type="button" className="knopf schlicht" aria-label={`Abwesenheit ${i + 1} entfernen`} onClick={() => onAendern(liste.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      <button type="button" className="knopf schlicht" onClick={() => onAendern([...liste, { tag: montag, grund: 'urlaub', stunden: tagSoll, text: '' }])}>
        Abwesenheit hinzufügen
      </button>
    </fieldset>
  );
}

export function BerichtSeite({ azubiId, montag, eigenes }: { azubiId: number; montag: string; eigenes: boolean }) {
  const [b, setB] = useState<Bericht | null>(null);
  const [inhalt, setInhalt] = useState<BerichtInhalt | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean; unterschrift?: boolean } | null>(null);
  const [nichtGefunden, setNichtGefunden] = useState(false);
  const [grund, setGrund] = useState<'zurueckgeben' | 'oeffnen' | null>(null);
  const [kommentar, setKommentar] = useState('');
  const pfad = `/api/azubis/${azubiId}/berichte/${montag}`;
  const zurListe = berichtsheftPfad(azubiId, eigenes);

  const uebernimm = useCallback((neu: Bericht) => {
    setB(neu);
    setInhalt(neu.inhalt);
    setGeaendert(false);
  }, []);

  useEffect(() => {
    api<Bericht>('GET', pfad).then(uebernimm, () => setNichtGefunden(true));
  }, [pfad, uebernimm]);

  // Warnung des Browsers, wenn ungespeicherte Änderungen verloren gingen
  useEffect(() => {
    if (!geaendert) return;
    const warne = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warne);
    return () => window.removeEventListener('beforeunload', warne);
  }, [geaendert]);

  if (nichtGefunden) {
    return (
      <>
        <h1>Bericht nicht gefunden</h1>
        <p>
          <Link zu={zurListe}>Zum Berichtsheft</Link>
        </p>
      </>
    );
  }
  if (!b || !inhalt) return <p className="leise">Lädt …</p>;

  const fehler = (e: unknown) =>
    setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true, unterschrift: e instanceof ApiFehler && e.code === 'unterschrift' });
  const aendere = (teil: Partial<BerichtInhalt>) => {
    setInhalt({ ...inhalt, ...teil });
    setGeaendert(true);
    setMeldung(null);
  };

  const speichere = async (): Promise<boolean> => {
    try {
      uebernimm(await api<Bericht>('PUT', pfad, { inhalt }));
      setMeldung({ text: 'Gespeichert.', fehler: false });
      return true;
    } catch (e) {
      fehler(e);
      return false;
    }
  };
  const tue = async (aktion: string, body?: unknown, erfolg?: string) => {
    try {
      uebernimm(await api<Bericht>('POST', `${pfad}/${aktion}`, body));
      setMeldung(erfolg ? { text: erfolg, fehler: false } : null);
      setGrund(null);
      setKommentar('');
    } catch (e) {
      fehler(e);
    }
  };
  const reicheEin = async () => {
    // erst speichern, dann einreichen – so geht nichts verloren
    if ((geaendert || b.status === 'fehlt') && !(await speichere())) return;
    await tue('einreichen', undefined, 'Eingereicht. Der Bericht liegt jetzt zum Abzeichnen vor.');
  };
  const zeichneAb = async () => {
    try {
      await api('POST', '/api/berichte/abzeichnen', { berichte: [{ azubiId, montag }] });
      uebernimm(await api<Bericht>('GET', pfad));
      setMeldung({ text: 'Abgezeichnet.', fehler: false });
    } catch (e) {
      fehler(e);
    }
  };
  const loesche = async () => {
    if (!window.confirm('Diesen Entwurf löschen?')) return;
    try {
      await api('DELETE', pfad);
      geheZu(zurListe);
    } catch (e) {
      fehler(e);
    }
  };

  const ist = summeVon(inhalt);

  return (
    <>
      <p className="klein nicht-drucken">
        <Link zu={zurListe}>← Berichtsheft{eigenes ? '' : ` von ${b.kopf.azubi}`}</Link>
      </p>
      <h1 className="nicht-drucken">
        Woche {b.kw}/{b.jahr} <span className={`pille ${STATUS_FARBE[b.status]}`}>{STATUS_TEXT[b.status]}</span>
      </h1>
      <p className="leise nicht-drucken">
        {wocheText(b.montag, b.sonntag)}
        {b.ausbildungsjahr ? ` · ${b.ausbildungsjahr}. Ausbildungsjahr` : ''}
      </p>

      {b.status === 'zurueck' && b.kommentar && (
        <div className="hinweis nicht-drucken" role="status">
          <strong>Zurückgegeben:</strong> <span className="mehrzeilig">{b.kommentar}</span>
        </div>
      )}
      {meldung && (
        <p className={`hinweis nicht-drucken ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text} {meldung.unterschrift && <Link zu="/konto">Zur Unterschrift</Link>}
        </p>
      )}

      {b.rechte.schreiben ? (
        <section className="karte nicht-drucken">
          {ABSCHNITTE.map((a) => (
            <EintragListe key={a.schluessel} titel={a.titel} hilfe={a.hilfe} liste={inhalt[a.schluessel]} onAendern={(l) => aendere({ [a.schluessel]: l })} />
          ))}
          <AbwesenheitListe montag={b.montag} tagSoll={Math.round((b.soll / 5) * 4) / 4} liste={inhalt.abwesenheit} onAendern={(l) => aendere({ abwesenheit: l })} />
          <p className="blatt-summe" aria-live="polite">
            <strong>Summe: {h(ist)} Stunden</strong> <span className="leise">(Soll {h(b.soll)})</span>
            {Math.abs(ist - b.soll) > 0.01 && ist > 0 && <span className="leise"> · {ist > b.soll ? `${h(ist - b.soll)} mehr` : `${h(b.soll - ist)} weniger`} als das Soll</span>}
          </p>
          <div className="aktionen links">
            <button type="button" className="knopf schlicht" onClick={() => void speichere()} disabled={!geaendert && b.status !== 'fehlt'}>
              {b.status === 'fehlt' ? 'Als Entwurf speichern' : 'Speichern'}
            </button>
            <button type="button" className="knopf" onClick={() => void reicheEin()}>
              Einreichen
            </button>
            {b.rechte.loeschen && (
              <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
                Entwurf löschen
              </button>
            )}
          </div>
          <p className="leise klein">Mit dem Einreichen unterschreibst du den Bericht mit deiner hinterlegten Unterschrift. Danach kannst du ihn zurückziehen, solange er nicht abgezeichnet ist.</p>
        </section>
      ) : (
        <section className="karte">
          <BerichtBlatt b={b} />
        </section>
      )}

      {!b.rechte.schreiben && (
        <div className="aktionen links nicht-drucken abstand">
          {b.rechte.abzeichnen && (
            <>
              <button type="button" className="knopf" onClick={() => void zeichneAb()}>
                Abzeichnen
              </button>
              <button type="button" className="knopf schlicht" onClick={() => setGrund('zurueckgeben')}>
                Zurückgeben …
              </button>
            </>
          )}
          {b.rechte.oeffnen && (
            <button type="button" className="knopf schlicht" onClick={() => setGrund('oeffnen')}>
              Abzeichnung aufheben …
            </button>
          )}
          {b.rechte.zurueckziehen && (
            <button type="button" className="knopf schlicht" onClick={() => void tue('zurueckziehen', undefined, 'Zurückgezogen – du kannst den Bericht wieder bearbeiten.')}>
              Zurückziehen und bearbeiten
            </button>
          )}
          {b.status !== 'fehlt' && (
            <button type="button" className="knopf schlicht" onClick={() => window.print()}>
              Drucken
            </button>
          )}
        </div>
      )}

      {grund && (
        <section className="karte nicht-drucken">
          <h2>{grund === 'zurueckgeben' ? 'Bericht zurückgeben' : 'Abzeichnung aufheben'}</h2>
          <label>
            {grund === 'zurueckgeben' ? 'Was soll geändert werden?' : 'Warum wird die Abzeichnung aufgehoben?'}
            <textarea rows={3} maxLength={1000} value={kommentar} onChange={(e) => setKommentar(e.target.value)} />
          </label>
          <p className="leise klein">
            {grund === 'zurueckgeben' ? 'Der Azubi sieht den Kommentar und kann den Bericht überarbeiten.' : 'Die Unterschriften entfallen, der Bericht geht zur Überarbeitung an den Azubi. Der Vorgang wird protokolliert.'}
          </p>
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={!kommentar.trim()} onClick={() => void tue(grund, { kommentar }, grund === 'zurueckgeben' ? 'Zurückgegeben.' : 'Abzeichnung aufgehoben.')}>
              {grund === 'zurueckgeben' ? 'Zurückgeben' : 'Aufheben'}
            </button>
            <button type="button" className="knopf schlicht" onClick={() => setGrund(null)}>
              Abbrechen
            </button>
          </div>
        </section>
      )}

      {b.verlauf.length > 0 && (
        <section className="karte nicht-drucken">
          <h2>Verlauf</h2>
          <ul className="liste">
            {b.verlauf.map((v, i) => (
              <li key={i}>
                {zeit(v.zeit)} · <strong>{VERLAUF_TEXT[v.aktion] ?? v.aktion}</strong> von {v.name} ({ROLLE_TEXT[v.rolle]})
                {v.kommentar && <div className="leise mehrzeilig">{v.kommentar}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
