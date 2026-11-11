import { melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiFehler, ART_TEXT, berichtsheftPfad, datum, GRUND_TEXT, h, ROLLE_TEXT, STATUS_FARBE, STATUS_TEXT, wocheText, zeit } from '../api';
import type { Bericht, BerichtAbwesenheit, BerichtEintrag, BerichtInhalt, Grund } from '../api';
import { geheZu, Link, useUngespeichert } from '../router';
import { UnterschriftBild } from '../unterschrift';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const ABSCHNITTE: { schluessel: 'betrieb' | 'unterweisung' | 'schule'; titel: string; frage: string; hilfe: string; beispiel: string }[] = [
  { schluessel: 'betrieb', titel: 'Betriebliche Tätigkeiten', frage: '', hilfe: 'Was hast du im Betrieb gemacht? Schreib je Tätigkeit eine Zeile und trag die Stunden dazu ein.', beispiel: 'z. B. Wareneingang geprüft und 40 Artikel eingelagert' },
  { schluessel: 'unterweisung', titel: 'Unterweisungen und Schulungen', frage: 'Wurde dir etwas erklärt oder warst du auf einem Lehrgang?', hilfe: 'Wurde dir etwas erklärt oder warst du auf einem Lehrgang? Wenn nicht, lass den Teil leer.', beispiel: 'z. B. Unterweisung Arbeitssicherheit' },
  { schluessel: 'schule', titel: 'Berufsschule', frage: 'Warst du in dieser Woche in der Berufsschule?', hilfe: 'Warst du in der Berufsschule? Schreib die Themen aus dem Unterricht auf. Wenn nicht, lass den Teil leer.', beispiel: 'z. B. Mathe: Prozentrechnung' },
];

const ANTEILE: { schluessel: keyof BerichtInhalt; kurz: string }[] = [
  { schluessel: 'betrieb', kurz: 'Betrieb' },
  { schluessel: 'unterweisung', kurz: 'Unterweisung' },
  { schluessel: 'schule', kurz: 'Berufsschule' },
  { schluessel: 'abwesenheit', kurz: 'Abwesenheit' },
];
const teilSumme = (i: BerichtInhalt, k: keyof BerichtInhalt) => (i[k] as { stunden: number }[]).reduce((n, e) => n + (Number(e.stunden) || 0), 0);

/** Was der Stand für den Azubi bedeutet und was als Nächstes zu tun ist. */
const STATUS_HILFE: Record<string, string> = {
  fehlt: 'Für diese Woche hast du noch nichts geschrieben. Trag unten ein, was du gemacht hast.',
  entwurf: 'Das ist ein Entwurf. Nur du siehst ihn. Wenn alles drinsteht, wähle unten „Einreichen“.',
  eingereicht: 'Du hast den Bericht abgegeben. Jetzt liest ihn dein Ausbilder. Bis er unterschrieben hat, kannst du den Bericht zurückziehen und ändern.',
  zurueck: 'Dein Ausbilder möchte, dass du etwas änderst. Der Grund steht unten. Ändere den Bericht und reiche ihn noch einmal ein.',
  abgezeichnet: 'Fertig: Dein Ausbilder hat den Bericht unterschrieben. Er lässt sich nicht mehr ändern.',
};
const SCHRITTE = ['Schreiben', 'Einreichen', 'Abgezeichnet'];
const SCHRITT_VON: Record<string, number> = { fehlt: 0, entwurf: 0, zurueck: 0, eingereicht: 1, abgezeichnet: 2 };
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

/** Hinweis neben jedem Druck-Knopf: PDF und die Kopf- und Fußzeilen des Browsers. */
export function DruckHinweis() {
  return (
    <p className="leise klein nicht-drucken druck-hinweis">
      Im Druckfenster kannst du auch „Als PDF speichern“ wählen. Stehen am Rand des Ausdrucks Datum, Titel oder Adresse der Seite? Dann schalte im Druckfenster unter „Weitere Einstellungen“ die „Kopf- und Fußzeilen“ aus – der Browser merkt sich das.
    </p>
  );
}

/** Der Bericht zum Lesen und Drucken: Kopf, Inhalte, Summe, Unterschriften. */
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
        {/* ein Ausdruck vor dem Einreichen ist als solcher zu erkennen */}
        {(b.status === 'fehlt' || b.status === 'entwurf' || b.status === 'zurueck') && <div className="blatt-entwurf">Entwurf – noch nicht eingereicht und nicht unterschrieben</div>}
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

const std = (n: number) => `${h(n)} Std.`;

/** Kopf eines Teils: Nummer, Titel und rechts die Stunden dieses Teils. */
function TeilKopf({ nr, titel, stunden }: { nr: number; titel: string; stunden: number }) {
  return (
    <legend>
      <span className="ablauf-nr" aria-hidden="true">
        {nr}
      </span>
      <span className="teil-titel">{titel}</span>
      <span className={`pille ${stunden > 0 ? 'blau' : 'grau'}`}>{std(stunden)}</span>
    </legend>
  );
}

/** Ein Teil, in dem diese Woche nichts steht: eine Zeile statt eines leeren Formulars. */
function TeilZu({ nr, titel, frage, knopf, onAuf }: { nr: number; titel: string; frage: string; knopf: string; onAuf: () => void }) {
  return (
    <section className="karte teil zu" aria-label={titel}>
      <span className="ablauf-nr" aria-hidden="true">
        {nr}
      </span>
      <span className="teil-zu-text">
        <strong>{titel}</strong>
        <span className="leise klein">{frage}</span>
      </span>
      <button type="button" className="knopf schlicht klein" onClick={onAuf}>
        {knopf}
      </button>
    </section>
  );
}

function EintragListe({ nr, art, titel, hilfe, beispiel, liste, onAendern }: { nr: number; art: string; titel: string; hilfe: string; beispiel: string; liste: BerichtEintrag[]; onAendern: (l: BerichtEintrag[]) => void }) {
  const setze = (i: number, teil: Partial<BerichtEintrag>) => onAendern(liste.map((e, j) => (j === i ? { ...e, ...teil } : e)));
  return (
    <fieldset className={`abschnitt karte teil ${art}`}>
      <TeilKopf nr={nr} titel={titel} stunden={liste.reduce((n, e) => n + (Number(e.stunden) || 0), 0)} />
      <p className="leise klein abschnitt-hilfe">{hilfe}</p>
      {liste.map((e, i) => (
        <div className="bericht-zeile" key={i}>
          <span className="bericht-zeile-nr" aria-hidden="true">
            {i + 1}.
          </span>
          <label className="bericht-text">
            <span className="klein">
              Was hast du gemacht? <span className="nur-vorleser">({titel}, Zeile {i + 1})</span>
            </span>
            <textarea rows={2} value={e.text} maxLength={2000} placeholder={beispiel} onChange={(ev) => setze(i, { text: ev.target.value })} />
          </label>
          <label className="bericht-stunden">
            <span className="klein">Stunden</span>
            <input type="number" inputMode="decimal" min={0} max={60} step={0.25} value={e.stunden} aria-label={`Stunden, ${titel}, Zeile ${i + 1}`} onChange={(ev) => setze(i, { stunden: Number(ev.target.value) })} />
          </label>
          <button type="button" className="knopf schlicht klein bericht-weg" aria-label={`${titel}, Zeile ${i + 1} entfernen`} onClick={() => onAendern(liste.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      <button type="button" className="knopf schlicht klein" onClick={() => onAendern([...liste, { text: '', stunden: 0 }])}>
        {liste.length ? 'Weitere Zeile' : 'Zeile hinzufügen'}
      </button>
    </fieldset>
  );
}

function AbwesenheitListe({ nr, montag, tagSoll, liste, onAendern }: { nr: number; montag: string; tagSoll: number; liste: BerichtAbwesenheit[]; onAendern: (l: BerichtAbwesenheit[]) => void }) {
  const setze = (i: number, teil: Partial<BerichtAbwesenheit>) => onAendern(liste.map((e, j) => (j === i ? { ...e, ...teil } : e)));
  // der nächste freie Tag der Woche als Vorschlag – wer drei Tage krank war, klickt dreimal
  const naechsterTag = () => TAGE.map((_, t) => plusTage(montag, t)).find((tag) => !liste.some((a) => a.tag === tag)) ?? montag;
  return (
    <fieldset className="abschnitt karte teil abwesenheit">
      <TeilKopf nr={nr} titel="Abwesenheit" stunden={liste.reduce((n, a) => n + (Number(a.stunden) || 0), 0)} />
      <p className="leise klein abschnitt-hilfe">Urlaub, krank oder Feiertag? Trag jeden Tag einzeln ein. Die Stunden für einen ganzen Tag ({std(tagSoll)}) stehen schon drin.</p>
      {liste.map((a, i) => (
        <div className="bericht-zeile abwesend" key={i}>
          <span className="bericht-zeile-nr" aria-hidden="true">
            {i + 1}.
          </span>
          <label>
            <span className="klein">Tag</span>
            <select value={a.tag} onChange={(ev) => setze(i, { tag: ev.target.value })}>
              {TAGE.map((name, t) => (
                <option key={t} value={plusTage(montag, t)}>
                  {name}, {datum(plusTage(montag, t))}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="klein">Grund</span>
            <select value={a.grund} onChange={(ev) => setze(i, { grund: ev.target.value as Grund })}>
              {(Object.keys(GRUND_TEXT) as Grund[]).map((g) => (
                <option key={g} value={g}>
                  {GRUND_TEXT[g]}
                </option>
              ))}
            </select>
          </label>
          <label className="bericht-stunden">
            <span className="klein">Stunden</span>
            <input type="number" inputMode="decimal" min={0} max={24} step={0.25} value={a.stunden} onChange={(ev) => setze(i, { stunden: Number(ev.target.value) })} />
          </label>
          <label className="bericht-hinweis">
            <span className="klein">Hinweis (freiwillig)</span>
            <input value={a.text} maxLength={200} onChange={(ev) => setze(i, { text: ev.target.value })} />
          </label>
          <button type="button" className="knopf schlicht klein bericht-weg" aria-label={`Abwesenheit ${i + 1} entfernen`} onClick={() => onAendern(liste.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      <button type="button" className="knopf schlicht klein" disabled={liste.length >= 7} onClick={() => onAendern([...liste, { tag: naechsterTag(), grund: 'urlaub', stunden: tagSoll, text: '' }])}>
        {liste.length ? 'Weiteren Tag eintragen' : 'Tag eintragen'}
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
  // Teile, die der Azubi von Hand aufgeklappt hat (leere Teile sind sonst nur eine Zeile)
  const [auf, setAuf] = useState<Set<string>>(new Set());
  useUngespeichert(geaendert);
  const sollDrucken = useRef(new URLSearchParams(window.location.search).has('drucken'));
  useEffect(() => {
    if (!b || !sollDrucken.current) return;
    sollDrucken.current = false;
    // die Adresse wieder ohne „?drucken“ – sonst würde ein Neuladen noch einmal drucken (derselbe Verlaufseintrag bleibt)
    window.history.replaceState(window.history.state, '', window.location.pathname);
    const zeit = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(zeit);
  }, [b]);
  const pfad = `/api/azubis/${azubiId}/berichte/${montag}`;
  const zurListe = berichtsheftPfad(azubiId, eigenes);

  const uebernimm = useCallback((neu: Bericht) => {
    setB(neu);
    // ein neuer Bericht beginnt mit einer leeren Zeile – so ist sofort klar, wo man schreibt
    setInhalt(neu.status === 'fehlt' && neu.rechte.schreiben && neu.inhalt.betrieb.length === 0 ? { ...neu.inhalt, betrieb: [{ text: '', stunden: 0 }] } : neu.inhalt);
    setGeaendert(false);
  }, []);

  useEffect(() => {
    api<Bericht>('GET', pfad).then(uebernimm, () => setNichtGefunden(true));
  }, [pfad, uebernimm]);

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
      setMeldung(null);
      melde('Gespeichert.');
      return true;
    } catch (e) {
      fehler(e);
      return false;
    }
  };
  const tue = async (aktion: string, body?: unknown, erfolg?: string) => {
    try {
      uebernimm(await api<Bericht>('POST', `${pfad}/${aktion}`, body));
      setMeldung(null);
      if (erfolg) melde(erfolg);
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
      setMeldung(null);
      melde('Abgezeichnet.');
    } catch (e) {
      fehler(e);
    }
  };
  const loesche = async () => {
    if (!(await rueckfrage('Diesen Entwurf löschen?\n\nDer Text dieser Woche ist danach weg. Die Woche gilt wieder als „fehlt“.', { ja: 'Entwurf löschen', gefahr: true }))) return;
    try {
      await api('DELETE', pfad);
      geheZu(zurListe);
    } catch (e) {
      fehler(e);
    }
  };

  const ist = summeVon(inhalt);
  const tagSoll = Math.round((b.soll / 5) * 4) / 4;
  const inSchule = b.plan.some((p) => p.art === 'schule');
  const stand = ist <= 0 ? 'leer' : Math.abs(ist - b.soll) <= 0.01 ? 'genau' : ist > b.soll ? 'mehr' : 'weniger';
  const standText =
    stand === 'leer'
      ? `Deine Wochenstunden: ${h(b.soll)} – das sind ${h(tagSoll)} je Tag.`
      : stand === 'genau'
        ? 'Passt genau zu deinen Wochenstunden.'
        : stand === 'mehr'
          ? `${h(ist - b.soll)} Stunden mehr als deine Wochenstunden.`
          : `Es fehlen noch ${h(b.soll - ist)} Stunden.`;
  // dieselben Knöpfe in der Randspalte (PC) und in der Leiste unten (Handy, Tablet – dort mit kurzer Beschriftung)
  const speicherText = b.status === 'fehlt' || b.status === 'entwurf' ? 'Als Entwurf speichern' : 'Bericht speichern';
  const aktionen = (kurz: boolean) => (
    <div className="aktionen links">
      <button type="button" className={`knopf${kurz ? ' klein' : ''}`} onClick={() => void reicheEin()}>
        Einreichen
      </button>
      <button type="button" className={`knopf schlicht${kurz ? ' klein' : ''}`} aria-label={speicherText} onClick={() => void speichere()} disabled={!geaendert && b.status !== 'fehlt'}>
        {kurz ? 'Speichern' : speicherText}
      </button>
      {!kurz && ist > 0 && (
        <button type="button" className="knopf schlicht" onClick={() => window.print()}>
          Bericht drucken
        </button>
      )}
      {!kurz && b.rechte.loeschen && (
        <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
          Entwurf löschen
        </button>
      )}
    </div>
  );

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

      {eigenes && (
        <>
          <ol className="ablauf nicht-drucken" aria-label="Ablauf des Berichts">
            {SCHRITTE.map((s, i) => {
              const stand = SCHRITT_VON[b.status] ?? 0;
              return (
                <li key={s} className={i < stand ? 'erledigt' : i === stand ? 'aktuell' : undefined} aria-current={i === stand ? 'step' : undefined}>
                  <span className="ablauf-nr">{i + 1}</span>
                  {s}
                  {i < stand && <span className="nur-vorleser"> (erledigt)</span>}
                </li>
              );
            })}
          </ol>
          <p className="nicht-drucken">{STATUS_HILFE[b.status]}</p>
        </>
      )}

      {b.status === 'zurueck' && b.kommentar && (
        <div className="hinweis nicht-drucken" role="status">
          <strong>{eigenes ? 'Das sollst du ändern:' : 'Zurückgegeben:'}</strong> <span className="mehrzeilig">{b.kommentar}</span>
        </div>
      )}
      {meldung && (
        <p className={`hinweis nicht-drucken ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text} {meldung.unterschrift && <Link zu="/konto">Zur Unterschrift</Link>}
        </p>
      )}

      {b.rechte.schreiben ? (
        <div className="bericht-eingabe nicht-drucken">
          <div className="bericht-teile">
            {b.plan.length > 0 && (
              <p className="bericht-plan">
                <strong>Laut Ausbildungsplan in dieser Woche:</strong>{' '}
                {b.plan.map((p, i) => (
                  <span key={i} className={`legende-art ${p.art}`}>
                    {ART_TEXT[p.art]} „{p.titel}“
                  </span>
                ))}
              </p>
            )}
            {ABSCHNITTE.map((a, i) =>
              a.schluessel === 'betrieb' || inhalt[a.schluessel].length > 0 || auf.has(a.schluessel) || (a.schluessel === 'schule' && inSchule) ? (
                <EintragListe key={a.schluessel} nr={i + 1} art={a.schluessel} titel={a.titel} hilfe={a.hilfe} beispiel={a.beispiel} liste={inhalt[a.schluessel]} onAendern={(l) => aendere({ [a.schluessel]: l })} />
              ) : (
                <TeilZu
                  key={a.schluessel}
                  nr={i + 1}
                  titel={a.titel}
                  frage={a.frage}
                  knopf="Eintragen"
                  onAuf={() => {
                    setAuf(new Set(auf).add(a.schluessel));
                    aendere({ [a.schluessel]: [{ text: '', stunden: 0 }] });
                  }}
                />
              ),
            )}
            {inhalt.abwesenheit.length > 0 || auf.has('abwesenheit') ? (
              <AbwesenheitListe nr={4} montag={b.montag} tagSoll={tagSoll} liste={inhalt.abwesenheit} onAendern={(l) => aendere({ abwesenheit: l })} />
            ) : (
              <TeilZu
                nr={4}
                titel="Abwesenheit"
                frage="Urlaub, krank oder Feiertag in dieser Woche?"
                knopf="Eintragen"
                onAuf={() => {
                  setAuf(new Set(auf).add('abwesenheit'));
                  aendere({ abwesenheit: [{ tag: b.montag, grund: 'urlaub', stunden: tagSoll, text: '' }] });
                }}
              />
            )}
          </div>

          <aside className="karte bericht-rand" aria-label="Zusammenfassung der Woche">
            <h2>Deine Woche</h2>
            <p className="bericht-summe" aria-live="polite">
              <strong>{h(ist)}</strong> von {h(b.soll)} Stunden
            </p>
            <div className={`bericht-balken ${stand}`} aria-hidden="true">
              <i style={{ width: `${Math.min(100, b.soll > 0 ? (ist / b.soll) * 100 : 0)}%` }} />
            </div>
            <p className={`bericht-stand ${stand}`}>{standText}</p>
            <dl className="bericht-anteile">
              {ANTEILE.map((t) => (
                <div key={t.schluessel}>
                  <dt>{t.kurz}</dt>
                  <dd>{std(teilSumme(inhalt, t.schluessel))}</dd>
                </div>
              ))}
            </dl>
            <p className={`bericht-sicher klein ${geaendert ? 'offen' : 'leise'}`} role="status">
              {geaendert ? 'Noch nicht gespeichert' : b.status === 'fehlt' ? 'Noch nichts gespeichert' : 'Alles gespeichert'}
            </p>
            {aktionen(false)}
            <details className="bericht-erklaerung">
              <summary>Entwurf oder einreichen?</summary>
              <p className="leise klein">
                <strong>Als Entwurf speichern:</strong> Du bist noch nicht fertig und schreibst später weiter. Nur du siehst den Entwurf.
              </p>
              <p className="leise klein">
                <strong>Einreichen:</strong> Du bist fertig. Du unterschreibst den Bericht und gibst ihn an deinen Ausbilder. Bis er unterschrieben hat, kannst du ihn noch zurückholen.
              </p>
            </details>
          </aside>

          <p className="bericht-ende">
            {ist > 0 && (
              <button type="button" className="knopf schlicht" onClick={() => window.print()}>
                Bericht drucken
              </button>
            )}
            {b.rechte.loeschen && (
              <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
                Entwurf löschen
              </button>
            )}
          </p>
          {/* Handy und Tablet: Summe und Knöpfe bleiben beim Schreiben am unteren Rand erreichbar */}
          <div className="bericht-leiste" role="group" aria-label="Stunden und Speichern">
            <span className="bericht-leiste-summe">
              <span>
                <strong>{h(ist)}</strong> von {h(b.soll)} Std.
              </span>
              <span className={`bericht-balken ${stand}`} aria-hidden="true">
                <i style={{ width: `${Math.min(100, b.soll > 0 ? (ist / b.soll) * 100 : 0)}%` }} />
              </span>
            </span>
            {aktionen(true)}
          </div>
        </div>
      ) : (
        <section className="karte druckseite">
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
              Bericht drucken
            </button>
          )}
        </div>
      )}
      {/* beim Schreiben: Auf dem Bildschirm steht das Formular, gedruckt wird das Blatt mit dem aktuellen Stand der Eingabe */}
      {b.rechte.schreiben && (
        <section className="karte druckseite nur-drucken">
          <BerichtBlatt b={{ ...b, inhalt, summe: { ...b.summe, gesamt: ist } }} />
        </section>
      )}
      {(b.status !== 'fehlt' || ist > 0) && <DruckHinweis />}

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
