import { melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiFehler, ladeDatei, ART_TEXT, berichtsheftPfad, datum, GRUND_TEXT, h, ROLLE_TEXT, STATUS_FARBE, STATUS_TEXT, wocheText, zeit } from '../api';
import type { Bericht, BerichtAbwesenheit, BerichtAnhang, BerichtEintrag, BerichtInhalt, Grund, Logos } from '../api';
import { Anhaenge } from '../berichtAnhaenge';
import { HandbuchLink } from '../handbuchLink';
import { Icon } from '../icons';
import { geheZu, Link, useUngespeichert } from '../router';
import { UnterschriftBild } from '../unterschrift';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const ABSCHNITTE: { schluessel: 'betrieb' | 'unterweisung' | 'schule'; titel: string; frage: string; hilfe: string; beispiel: string }[] = [
  { schluessel: 'betrieb', titel: 'Betriebliche Tätigkeiten', frage: '', hilfe: 'Was hast du im Betrieb gemacht? Schreib je Tätigkeit eine Zeile und trag die Stunden dazu ein.', beispiel: 'z. B. Wareneingang geprüft und 40 Artikel eingelagert' },
  { schluessel: 'unterweisung', titel: 'Unterweisungen und Schulungen', frage: 'Wurde dir etwas erklärt oder warst du auf einem Lehrgang?', hilfe: 'Wurde dir etwas erklärt oder warst du auf einem Lehrgang? Wenn nicht, lass den Teil leer.', beispiel: 'z. B. Unterweisung Arbeitssicherheit' },
  { schluessel: 'schule', titel: 'Berufsschule', frage: 'Warst du in dieser Woche in der Berufsschule?', hilfe: 'Warst du in der Berufsschule? Schreib die Themen aus dem Unterricht auf. Wenn nicht, lass den Teil leer.', beispiel: 'z. B. Mathe: Prozentrechnung' },
];

const ANHANG_HILFE = 'Du kannst Fotos, PDF und Office-Dateien anhängen, je Datei bis 5 MB. Sie werden sofort gespeichert. Achte darauf, dass keine anderen Personen und nichts Vertrauliches zu sehen ist.';

type Art = (typeof ABSCHNITTE)[number]['schluessel'];
const ART_KURZ: Record<Art, string> = { betrieb: 'Betrieb', unterweisung: 'Unterweisung', schule: 'Berufsschule' };
/** Tagesform: was über dem Textfeld einer Zeile steht */
const ART_FRAGE: Record<Art, string> = { betrieb: 'Betrieb – was hast du gemacht?', unterweisung: 'Unterweisung – was wurde dir erklärt?', schule: 'Berufsschule – welche Themen?' };

interface TagZeile {
  art: Art;
  /** Stelle des Eintrags in der Liste seiner Art */
  index: number;
  eintrag: BerichtEintrag;
}
interface Tag {
  tag: string;
  name: string;
  zeilen: TagZeile[];
  abwesend: BerichtAbwesenheit[];
  summe: number;
}

/** Tagesform: die Einträge der drei Teile nach Tagen geordnet. Montag bis Freitag immer, Samstag und Sonntag nur mit Inhalt (oder wenn gewünscht). */
function tageDerWoche(montag: string, i: BerichtInhalt, mitWochenende = false): Tag[] {
  return TAGE.map((name, t): Tag => {
    const tag = plusTage(montag, t);
    const zeilen = ABSCHNITTE.flatMap((a) => i[a.schluessel].map((eintrag, index) => ({ art: a.schluessel, index, eintrag })).filter((z) => z.eintrag.tag === tag));
    const abwesend = i.abwesenheit.filter((a) => a.tag === tag);
    return { tag, name, zeilen, abwesend, summe: [...zeilen.map((z) => z.eintrag), ...abwesend].reduce((n, e) => n + (Number(e.stunden) || 0), 0) };
  }).filter((t, nr) => nr < 5 || mitWochenende || t.zeilen.length > 0 || t.abwesend.length > 0);
}

const ANTEILE: { schluessel: Exclude<keyof BerichtInhalt, 'form'>; kurz: string }[] = [
  { schluessel: 'betrieb', kurz: 'Betrieb' },
  { schluessel: 'unterweisung', kurz: 'Unterweisung' },
  { schluessel: 'schule', kurz: 'Berufsschule' },
  { schluessel: 'abwesenheit', kurz: 'Abwesenheit' },
];
const teilSumme = (i: BerichtInhalt, k: Exclude<keyof BerichtInhalt, 'form'>) => (i[k] as { stunden: number }[]).reduce((n, e) => n + (Number(e.stunden) || 0), 0);

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

/**
 * Knopf, der ein PDF vom Server holt und speichert. Solange das PDF entsteht, ist er gesperrt;
 * ein Fehler steht direkt darunter. `gesperrt` nennt den Grund, warum es gerade nicht geht.
 */
export function PdfKnopf({ pfad, text, klasse = 'knopf schlicht', gesperrt, symbol }: { pfad: string; text: string; klasse?: string; gesperrt?: string; /** nur das Symbol zeigen; der Text steht dann im Tooltip und für Vorleseprogramme */ symbol?: boolean }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  return (
    <>
      <button
        type="button"
        className={symbol ? `${klasse} symbol pdf-symbol` : klasse}
        title={symbol ? (laeuft ? 'PDF wird erstellt …' : (gesperrt ?? text)) : undefined}
        aria-label={symbol ? (gesperrt ? `${text} – ${gesperrt}` : text) : undefined}
        aria-busy={laeuft || undefined}
        disabled={laeuft || !!gesperrt}
        onClick={() => {
          setLaeuft(true);
          setFehler('');
          ladeDatei(pfad)
            .then(() => melde('PDF erstellt – es liegt bei deinen Downloads.'))
            .catch((e: unknown) => setFehler(e instanceof Error ? e.message : 'Das PDF ließ sich nicht erstellen.'))
            .finally(() => setLaeuft(false));
        }}
      >
        {symbol ? (
          <>
            <Icon name="pdf" />
            <span className="pdf-kuerzel" aria-hidden="true">
              PDF
            </span>
          </>
        ) : laeuft ? (
          'PDF wird erstellt …'
        ) : (
          text
        )}
      </button>
      {gesperrt && !symbol && <span className="leise klein pdf-grund">{gesperrt}</span>}
      {fehler && (
        <span className="hinweis fehler pdf-fehler" role="alert">
          {fehler}
        </span>
      )}
    </>
  );
}

/** Hinweis neben jedem Druck-Knopf: PDF und die Kopf- und Fußzeilen des Browsers. */
export function DruckHinweis() {
  return (
    <p className="leise klein nicht-drucken druck-hinweis">
      „Als PDF herunterladen“ erzeugt die Datei direkt. „Bericht drucken“ öffnet das Druckfenster. <HandbuchLink kapitel="drucken">PDF herunterladen und drucken</HandbuchLink>
    </p>
  );
}

/** Logo des Betriebs (helle Fassung) für den Ausdruck – einmal je Sitzung geholt. */
let logoAbruf: Promise<Logos> | null = null;
function useDruckLogo(): string | null {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    let aktuell = true;
    (logoAbruf ??= api<Logos>('GET', '/api/branding')).then(
      (l) => aktuell && setLogo(l.logo),
      () => {
        logoAbruf = null;
      },
    );
    return () => {
      aktuell = false;
    };
  }, []);
  return logo;
}

/** Der Bericht zum Lesen und Drucken: Kopf, Inhalte, Summe, Unterschriften. */
export function BerichtBlatt({ b }: { b: Bericht }) {
  const logo = useDruckLogo();
  const azubi = b.signaturen.find((s) => s.art === 'azubi');
  const abzeichnung = b.signaturen.find((s) => s.art === 'abzeichnung');
  // nicht abgezeichnete Berichte sind auf dem Blatt unübersehbar gekennzeichnet – am Bildschirm, im Ausdruck und im PDF
  const vermerk = b.status === 'abgezeichnet' ? '' : b.status === 'eingereicht' ? 'Nicht abgezeichnet' : 'Entwurf';
  return (
    <article className={`blatt${vermerk ? ' offen' : ''}`} data-vermerk={vermerk || undefined}>
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
        {b.status === 'eingereicht' && <div className="blatt-entwurf">Eingereicht – noch nicht abgezeichnet</div>}
      </header>

      {b.inhalt.form === 'tag' &&
        tageDerWoche(b.montag, b.inhalt).map((t) => (
          <section key={t.tag}>
            <h3>
              {t.name}, {datum(t.tag)}
              {t.summe > 0 && <span className="blatt-tagsumme"> · {h(t.summe)} h</span>}
            </h3>
            {t.zeilen.length === 0 && t.abwesend.length === 0 ? (
              <p className="leise">–</p>
            ) : (
              <table className="blatt-tabelle">
                <tbody>
                  {t.zeilen.map((z) => (
                    <tr key={`${z.art}-${z.index}`}>
                      <td className="mehrzeilig">
                        <span className="blatt-art">{ART_KURZ[z.art]}:</span> {z.eintrag.text}
                      </td>
                      <td className="zahl">{h(z.eintrag.stunden)} h</td>
                    </tr>
                  ))}
                  {t.abwesend.map((a, i) => (
                    <tr key={`a-${i}`}>
                      <td>
                        <span className="blatt-art">Abwesenheit:</span> {GRUND_TEXT[a.grund]}
                        {a.text ? ` (${a.text})` : ''}
                      </td>
                      <td className="zahl">{h(a.stunden)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

      {b.inhalt.form !== 'tag' && ABSCHNITTE.map((a) => (
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

      {b.inhalt.form !== 'tag' && <section>
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
      </section>}

      <p className="blatt-summe">
        <strong>Summe: {h(b.summe.gesamt)} Stunden</strong> <span className="leise">(Soll {h(b.soll)})</span>
      </p>

      <div className="signaturen">
        {[
          { titel: 'Auszubildende/r', s: azubi },
          { titel: 'Ausbilder/in bzw. Ausbildungsbeauftragte/r', s: abzeichnung },
        ].map(({ titel, s }) => (
          <div key={titel} className="signatur">
            <div className="signatur-feld">
              {/* nur im Ausdruck: das Logo des Betriebs blass hinter der Unterschrift, wie ein Stempel */}
              {logo && <img className="signatur-logo nur-drucken" src={logo} alt="" />}
              {s && <UnterschriftBild pfad={s.pfad} titel={`Unterschrift von ${s.name}`} />}
            </div>
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

/** Tagesform: je Tag eine Karte mit den Zeilen des Tages. Jede Zeile gehört zu Betrieb, Unterweisung oder Berufsschule. */
function TagesEingabe({ montag, inhalt, tagSoll, wochenende, onWochenende, onAendern, anhaenge }: { montag: string; inhalt: BerichtInhalt; tagSoll: number; wochenende: boolean; onWochenende: () => void; onAendern: (teil: Partial<BerichtInhalt>) => void; /** zeichnet die Anhänge eines Tages */ anhaenge: (tag: string, name: string) => ReactNode }) {
  const tage = tageDerWoche(montag, inhalt, wochenende);
  const setze = (z: TagZeile, teil: Partial<BerichtEintrag>) => onAendern({ [z.art]: inhalt[z.art].map((e, j) => (j === z.index ? { ...e, ...teil } : e)) });
  const entferne = (z: TagZeile) => onAendern({ [z.art]: inhalt[z.art].filter((_, j) => j !== z.index) });
  const neu = (art: Art, tag: string) => onAendern({ [art]: [...inhalt[art], { text: '', stunden: 0, tag }] });
  return (
    <>
      {tage.map((t, nr) => (
        <fieldset key={t.tag} className="abschnitt karte teil tag">
          <legend>
            <span className="ablauf-nr" aria-hidden="true">
              {nr + 1}
            </span>
            <span className="teil-titel">
              {t.name}, {datum(t.tag)}
            </span>
            <span className={`pille ${t.summe > 0 ? 'blau' : 'grau'}`}>{std(t.summe)}</span>
          </legend>
          {t.abwesend.map((a, i) => (
            <p key={i} className="bericht-tag-abwesend klein">
              <strong>Abwesend:</strong> {GRUND_TEXT[a.grund]}
              {a.text ? ` (${a.text})` : ''} · {std(a.stunden)} <span className="leise">– ändern unten bei „Abwesenheit“</span>
            </p>
          ))}
          {t.zeilen.length === 0 && t.abwesend.length === 0 && <p className="leise klein abschnitt-hilfe">Noch nichts eingetragen – ein voller Tag hat {std(tagSoll)}</p>}
          {t.zeilen.map((z, i) => (
            <div className="bericht-zeile" key={`${z.art}-${z.index}`}>
              <span className="bericht-zeile-nr" aria-hidden="true">
                {i + 1}.
              </span>
              <label className="bericht-text">
                <span className="klein">
                  {ART_FRAGE[z.art]} <span className="nur-vorleser">({t.name}, Zeile {i + 1})</span>
                </span>
                <textarea rows={2} value={z.eintrag.text} maxLength={2000} placeholder={ABSCHNITTE.find((a) => a.schluessel === z.art)?.beispiel} onChange={(ev) => setze(z, { text: ev.target.value })} />
              </label>
              <label className="bericht-stunden">
                <span className="klein">Stunden</span>
                <input type="number" inputMode="decimal" min={0} max={24} step={0.25} value={z.eintrag.stunden} aria-label={`Stunden, ${t.name}, Zeile ${i + 1}`} onChange={(ev) => setze(z, { stunden: Number(ev.target.value) })} />
              </label>
              <button type="button" className="knopf schlicht klein bericht-weg" aria-label={`${t.name}, Zeile ${i + 1} entfernen`} onClick={() => entferne(z)}>
                Entfernen
              </button>
            </div>
          ))}
          <div className="aktionen links bericht-tag-neu">
            <button type="button" className="knopf schlicht klein" onClick={() => neu('betrieb', t.tag)}>
              Tätigkeit im Betrieb eintragen
            </button>
            <button type="button" className="knopf schlicht klein" onClick={() => neu('unterweisung', t.tag)}>
              Unterweisung eintragen
            </button>
            <button type="button" className="knopf schlicht klein" onClick={() => neu('schule', t.tag)}>
              Berufsschule eintragen
            </button>
          </div>
          {anhaenge(t.tag, t.name)}
        </fieldset>
      ))}
      {!wochenende && tage.length < 7 && (
        <p>
          <button type="button" className="link-knopf" onClick={onWochenende}>
            Am Samstag oder Sonntag gearbeitet? Wochenende anzeigen
          </button>
        </p>
      )}
    </>
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
  // Tagesform: Samstag und Sonntag zeigen, auch wenn dort noch nichts steht
  const [wochenende, setWochenende] = useState(false);
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
  const pdfPfad = `/api/azubis/${azubiId}/berichtsheft.pdf?woche=${montag}`;

  const uebernimm = useCallback((neu: Bericht) => {
    setB(neu);
    // ein neuer Bericht beginnt mit einer leeren Zeile – so ist sofort klar, wo man schreibt
    // (in der Tagesform am ersten Tag der Woche, an dem der Azubi nicht abwesend ist)
    const ersterTag = [0, 1, 2, 3, 4].map((t) => plusTage(neu.montag, t)).find((tag) => !neu.inhalt.abwesenheit.some((a) => a.tag === tag)) ?? neu.montag;
    const leer: BerichtEintrag = neu.inhalt.form === 'tag' ? { text: '', stunden: 0, tag: ersterTag } : { text: '', stunden: 0 };
    setInhalt(neu.status === 'fehlt' && neu.rechte.schreiben && neu.inhalt.betrieb.length === 0 ? { ...neu.inhalt, betrieb: [leer] } : neu.inhalt);
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
  // Anhänge hängen am gespeicherten Bericht: vor dem ersten Hochladen wird deshalb gespeichert, was gerade im Formular steht
  const vorAnhang = async (): Promise<boolean> => (geaendert || b.status === 'fehlt' ? speichere() : true);
  // nur die Liste der Anhänge erneuern – was im Formular steht, bleibt unberührt
  const setzeAnhaenge = (anhaenge: BerichtAnhang[]) => setB((alt) => alt && { ...alt, anhaenge });
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
  // die Abwesenheit steht hinter den Teilen (Wochenform: 3) bzw. hinter den Tagen
  const tage = inhalt.form === 'tag' ? tageDerWoche(b.montag, inhalt, wochenende) : [];
  const abwNr = inhalt.form === 'tag' ? tage.length + 1 : 4;
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
      {!kurz && b.status !== 'fehlt' && <PdfKnopf pfad={pdfPfad} text="Als PDF herunterladen" gesperrt={geaendert ? 'Erst speichern – das PDF zeigt den gespeicherten Stand.' : undefined} />}
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
            {inhalt.form === 'tag' && <TagesEingabe montag={b.montag} inhalt={inhalt} tagSoll={tagSoll} wochenende={wochenende} onWochenende={() => setWochenende(true)} onAendern={aendere} anhaenge={(tag, name) => <Anhaenge pfad={pfad} liste={b.anhaenge} tag={tag} schreibbar wo={name} vorher={vorAnhang} onGeaendert={setzeAnhaenge} />} />}
            {inhalt.form !== 'tag' && ABSCHNITTE.map((a, i) =>
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
              <AbwesenheitListe nr={abwNr} montag={b.montag} tagSoll={tagSoll} liste={inhalt.abwesenheit} onAendern={(l) => aendere({ abwesenheit: l })} />
            ) : (
              <TeilZu
                nr={abwNr}
                titel="Abwesenheit"
                frage="Urlaub, krank oder Feiertag in dieser Woche?"
                knopf="Eintragen"
                onAuf={() => {
                  setAuf(new Set(auf).add('abwesenheit'));
                  aendere({ abwesenheit: [{ tag: b.montag, grund: 'urlaub', stunden: tagSoll, text: '' }] });
                }}
              />
            )}
            {inhalt.form !== 'tag' && (
              <fieldset className="abschnitt karte teil anhang">
                <legend>
                  <span className="ablauf-nr" aria-hidden="true">
                    5
                  </span>
                  <span className="teil-titel">Fotos und Dateien</span>
                  <span className={`pille ${b.anhaenge.length > 0 ? 'blau' : 'grau'}`}>{b.anhaenge.length}</span>
                </legend>
                <p className="leise klein abschnitt-hilfe">{ANHANG_HILFE}</p>
                <Anhaenge pfad={pfad} liste={b.anhaenge} tag={null} schreibbar wo="diesem Bericht" vorher={vorAnhang} onGeaendert={setzeAnhaenge} />
              </fieldset>
            )}
            {inhalt.form === 'tag' && <p className="leise klein bericht-anhang-hinweis">{ANHANG_HILFE}</p>}
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
            {inhalt.form === 'tag' && (
              <>
                <h3 className="bericht-tage-titel">Je Tag</h3>
                <dl className="bericht-anteile">
                  {tage.map((t) => (
                    <div key={t.tag}>
                      <dt>{t.name}</dt>
                      <dd>{t.summe > 0 ? std(t.summe) : <span className="leise">noch leer</span>}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className={`bericht-sicher klein ${geaendert ? 'offen' : 'leise'}`} role="status">
              {geaendert ? 'Noch nicht gespeichert' : b.status === 'fehlt' ? 'Noch nichts gespeichert' : 'Alles gespeichert'}
            </p>
            {aktionen(false)}
            <p className="hilfe-zeile klein">
              <HandbuchLink kapitel="bericht">Entwurf oder einreichen?</HandbuchLink>
            </p>
          </aside>

          <p className="bericht-ende">
            {b.status !== 'fehlt' && <PdfKnopf pfad={pdfPfad} text="Als PDF herunterladen" gesperrt={geaendert ? 'Erst speichern – das PDF zeigt den gespeicherten Stand.' : undefined} />}
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
        <>
          <section className="karte druckseite">
            <BerichtBlatt b={b} />
          </section>
          {b.anhaenge.length > 0 && (
            <section className="karte nicht-drucken" aria-labelledby="anhaenge-titel">
              <h2 id="anhaenge-titel">Fotos und Dateien</h2>
              <p className="leise klein">Anhänge zum Bericht. Im Ausdruck und im PDF des Berichtshefts stehen sie nicht.</p>
              {b.inhalt.form === 'tag' ? (
                tageDerWoche(b.montag, b.inhalt, true)
                  .filter((t) => b.anhaenge.some((a) => a.tag === t.tag))
                  .map((t) => (
                    <div key={t.tag} className="anhang-tag">
                      <h3>
                        {t.name}, {datum(t.tag)}
                      </h3>
                      <Anhaenge pfad={pfad} liste={b.anhaenge} tag={t.tag} schreibbar={false} wo={t.name} />
                    </div>
                  ))
              ) : (
                <Anhaenge pfad={pfad} liste={b.anhaenge} tag={null} schreibbar={false} wo="diesem Bericht" />
              )}
            </section>
          )}
        </>
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
          {b.status !== 'fehlt' && <PdfKnopf pfad={pdfPfad} text="Als PDF herunterladen" />}
          {b.status !== 'fehlt' && (
            <button type="button" className="knopf schlicht" onClick={() => window.print()}>
              Bericht drucken
            </button>
          )}
        </div>
      )}
      {!b.rechte.schreiben && (b.rechte.abzeichnen || b.rechte.oeffnen) && (
        <p className="hilfe-zeile klein nicht-drucken">
          <HandbuchLink kapitel="abzeichnen">Berichte lesen, abzeichnen, zurückgeben</HandbuchLink>
        </p>
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
