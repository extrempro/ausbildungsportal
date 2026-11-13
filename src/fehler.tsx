import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, FormEvent } from 'react';
import { api } from './api';
import type { Rolle } from './api';
import { rueckfrage, useFensterFokus } from './dialoge';
import { useUngespeichert } from './router';
import { HandbuchLink } from './handbuchLink';

/**
 * „Rückmeldung geben“ – ein Fenster, drei Arten; jede geht an die, die damit etwas anfangen können:
 * - Fehler: kurzer Text, dazu automatisch ein paar technische Angaben, damit sich das Problem nachstellen lässt. Liest nur der Super-Admin.
 * - Idee fürs Portal: Text, Name und Seite. Lesen Super-Admin und Ausbilder.
 * - Lerninhalt besser erklären (nur Azubis): Text und Thema, OHNE Namen. Lesen nur die Ausbilder.
 */
type Art = 'fehler' | 'idee' | 'inhalt';
interface Bereich {
  bereich: 'lernen' | 'anleitungen';
  titel: string;
  felder: { id: string; titel: string; themen: { id: string; titel: string }[] }[];
}

const ARTEN: Record<Art, { wahl: string; wozu: string; frage: string; beispiel: string; hilfe: string; danke: string }> = {
  fehler: {
    wahl: 'Fehler melden',
    wozu: 'Etwas funktioniert nicht oder sieht falsch aus.',
    frage: 'Was ist passiert?',
    beispiel: 'Zum Beispiel: Ich wollte meinen Bericht einreichen. Nach dem Klick auf „Einreichen“ passiert nichts.',
    hilfe: 'Hilfreich ist: Was wolltest du tun? Was ist stattdessen passiert? Bitte schreibe keine Inhalte aus Berichten und keine Passwörter hinein.',
    danke: 'Der Betreiber des Portals sieht sie und kümmert sich darum. Eine Antwort bekommst du hier im Portal nicht – wenn es eilt, sprich bitte zusätzlich deinen Ausbilder an.',
  },
  idee: {
    wahl: 'Idee fürs Portal',
    wozu: 'Dir fehlt etwas, oder etwas ginge einfacher.',
    frage: 'Was wünschst du dir?',
    beispiel: 'Zum Beispiel: Ich würde gern sehen, wie viele Berichte mir bis zum Ende der Ausbildung noch fehlen.',
    hilfe: 'Hilfreich ist: Was möchtest du tun können, und wobei würde es dir helfen?',
    danke: 'Der Betreiber des Portals und die Ausbilder lesen sie. Eine Antwort bekommst du hier im Portal nicht – und nicht jede Idee lässt sich umsetzen.',
  },
  inhalt: {
    wahl: 'Lerninhalt besser erklären',
    wozu: 'Etwas im Lernmodul ist unklar, zu knapp oder fehlt.',
    frage: 'Was ist unklar oder fehlt?',
    beispiel: 'Zum Beispiel: Beim Subnetting verstehe ich nicht, wie man von /26 auf 62 Hosts kommt. Ein Rechenbeispiel Schritt für Schritt würde helfen.',
    hilfe: 'Je genauer, desto besser: Welche Stelle? Was hast du erwartet? Schreib nichts hinein, woran man dich erkennt, wenn du das nicht möchtest.',
    danke: 'Die Ausbilder lesen deinen Wunsch – ohne deinen Namen – und bessern die Lerninhalte nach, wenn es geht. Das kann etwas dauern. Wenn du es gleich wissen musst, frag deinen Ausbilder direkt.',
  },
};

/** Thema, das zur offenen Seite gehört – als „bereich|themenfeld|“, sonst leer */
function themaDerSeite(pfad: string, bereiche: Bereich[]): string {
  const m = /^\/(lernen|anleitungen)\/([a-z0-9-]{1,40})$/.exec(pfad);
  if (!m) return '';
  const b = bereiche.find((x) => x.bereich === m[1]);
  return b?.felder.some((f) => f.id === m[2]) ? `${m[1]}|${m[2]}|` : '';
}
const MAX_TEXT = 2000;
/** wie auf dem Server: so groß darf das verkleinerte Bild höchstens sein */
const MAX_BILD = 150 * 1024;

/**
 * Verkleinert ein Bild im Browser zu einem JPEG, das unter die Grenze passt:
 * erst die Breite begrenzen, dann schrittweise die Qualität und zuletzt die Größe senken.
 */
async function verkleinere(quelle: ImageBitmap | HTMLVideoElement, breite: number, hoehe: number): Promise<string> {
  let faktor = Math.min(1, 1600 / breite, 1600 / hoehe);
  for (let versuch = 0; versuch < 8; versuch++) {
    const flaeche = document.createElement('canvas');
    flaeche.width = Math.max(1, Math.round(breite * faktor));
    flaeche.height = Math.max(1, Math.round(hoehe * faktor));
    const stift = flaeche.getContext('2d');
    if (!stift) break;
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, flaeche.width, flaeche.height);
    stift.drawImage(quelle, 0, 0, flaeche.width, flaeche.height);
    for (const guete of [0.8, 0.6, 0.45]) {
      const url = flaeche.toDataURL('image/jpeg', guete);
      if ((url.length - url.indexOf(',') - 1) * 0.75 <= MAX_BILD) return url;
    }
    faktor *= 0.75;
  }
  throw new Error('Das Bild lässt sich nicht klein genug machen.');
}

async function ausDatei(datei: Blob): Promise<string> {
  if (!datei.type.startsWith('image/')) throw new Error('Bitte ein Bild wählen (zum Beispiel ein Bildschirmfoto).');
  let bild: ImageBitmap;
  try {
    bild = await createImageBitmap(datei);
  } catch {
    throw new Error('Dieses Bild lässt sich nicht lesen. Bitte ein PNG- oder JPEG-Bild wählen.');
  }
  try {
    return await verkleinere(bild, bild.width, bild.height);
  } finally {
    bild.close();
  }
}

/** Geht nur am PC: Der Browser fragt, welches Fenster er aufnehmen darf. Handys und Tablets bieten das nicht an. */
const kannAufnehmen = () => typeof navigator.mediaDevices?.getDisplayMedia === 'function' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

async function nimmAuf(): Promise<string> {
  // preferCurrentTab: Chrome und Edge schlagen dann gleich dieses Fenster vor
  const strom = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions);
  try {
    const film = document.createElement('video');
    film.muted = true;
    film.srcObject = strom;
    await film.play();
    // kurz warten, bis der Auswahldialog des Browsers weg ist und ein vollständiges Bild anliegt
    await new Promise((r) => setTimeout(r, 500));
    return await verkleinere(film, film.videoWidth, film.videoHeight);
  } finally {
    for (const spur of strom.getTracks()) spur.stop();
  }
}
const letzteFehler: string[] = [];

/** Merkt sich die letzten Fehlermeldungen des Browsers auf dieser Seite (nur im Speicher, höchstens fünf). */
export function merkeBrowserFehler(): void {
  const merke = (text: string) => {
    letzteFehler.push(`${new Date().toLocaleTimeString('de-DE')} ${text}`.slice(0, 280));
    if (letzteFehler.length > 5) letzteFehler.shift();
  };
  window.addEventListener('error', (e) => merke(e.message || 'Fehler ohne Text'));
  window.addEventListener('unhandledrejection', (e) => merke(String((e.reason as Error | undefined)?.message ?? e.reason)));
}

export function RueckmeldungFenster({ version, rolle, onZu }: { version: string; rolle: Rolle; onZu: () => void }) {
  const [text, setText] = useState('');
  const [art, setArt] = useState<Art | null>(null);
  // Azubis: die Themen ihrer Lerninhalte – null, solange sie laden; leer, wenn es für sie keine gibt
  const [bereiche, setBereiche] = useState<Bereich[] | null>(rolle === 'azubi' ? null : []);
  const [thema, setThema] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [bild, setBild] = useState<string | null>(null);
  // während der Aufnahme ist das Fenster unsichtbar, damit es nicht selbst auf dem Bild landet
  const [nimmtAuf, setNimmtAuf] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const flaeche = useRef<HTMLElement>(null);
  // Schließen fragt nach, sobald Text oder Bild da sind – ein versehentliches Escape kostet sonst die ganze Beschreibung
  const hatEingabe = useRef(false);
  hatEingabe.current = !fertig && (text.trim() !== '' || bild !== null);
  useUngespeichert(hatEingabe.current);
  const schliesse = useCallback(() => {
    if (!hatEingabe.current) onZu();
    else void rueckfrage('Rückmeldung verwerfen?\n\nDein Text ist noch nicht gesendet.', { ja: 'Verwerfen', gefahr: true }).then((ja) => ja && onZu());
  }, [onZu]);
  const seite = window.location.pathname;
  const fenster = `${window.innerWidth} × ${window.innerHeight}`;
  const technik = letzteFehler.join('\n');

  // Wer im Lernmodul steht, meint meist einen Lerninhalt: Art und Thema sind dann vorausgewählt
  useEffect(() => {
    if (rolle !== 'azubi') return;
    api<{ bereiche: Bereich[] }>('GET', '/api/rueckmeldungen/themen').then(
      (r) => {
        setBereiche(r.bereiche);
        if (r.bereiche.length === 0 || !/^\/(lernen|anleitungen)(\/|$)/.test(seite)) return;
        setArt((alt) => alt ?? 'inhalt');
        setThema(themaDerSeite(seite, r.bereiche));
      },
      () => setBereiche([]),
    );
  }, [rolle, seite]);
  const arten: Art[] = ['fehler', 'idee', ...(bereiche && bereiche.length > 0 ? (['inhalt'] as const) : [])];
  const a = art ? ARTEN[art] : null;

  // Fokus ins Fenster, Tab bleibt drin, Escape schließt (mit Nachfrage), danach zurück zum Knopf
  useFensterFokus(flaeche, schliesse, { sperren: true });

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', '/api/fehlermeldungen', art === 'inhalt' ? { art, text, thema } : art === 'idee' ? { art, text, seite } : { art, text, seite, fenster, technik, bild });
      setFertig(true);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Die Meldung konnte nicht gesendet werden');
    } finally {
      setLaeuft(false);
    }
  };

  const nimmBild = async (hole: () => Promise<string>) => {
    setFehler('');
    try {
      setBild(await hole());
    } catch (err) {
      // Abbrechen im Auswahlfenster des Browsers ist kein Fehler
      if (err instanceof DOMException) {
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') setFehler('Die Aufnahme hat in diesem Browser nicht geklappt. Mach das Bildschirmfoto bitte selbst und füge es mit „Bild auswählen“ oder Strg + V ein.');
      } else setFehler(err instanceof Error ? err.message : 'Das Bild konnte nicht übernommen werden');
    }
  };
  const aufnehmen = async () => {
    setNimmtAuf(true);
    await nimmBild(nimmAuf);
    setNimmtAuf(false);
  };
  // Bild aus der Zwischenablage (z. B. nach Windows-Taste + Umschalt + S); Text wird ganz normal eingefügt
  const einfuegen = (e: ClipboardEvent) => {
    const eintrag = [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const f = eintrag?.getAsFile();
    if (!f) return;
    e.preventDefault();
    void nimmBild(() => ausDatei(f));
  };

  return (
    <div className={`dialog-hintergrund${nimmtAuf ? ' unsichtbar' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && schliesse()}>
      <section ref={flaeche} className="karte dialog melden" role="dialog" aria-modal="true" aria-labelledby="melden-titel" onPaste={fertig || art !== 'fehler' ? undefined : einfuegen}>
        <h2 id="melden-titel">Rückmeldung geben</h2>
        {fertig ? (
          <>
            <p className="hinweis gut" role="status">
              Danke! Deine Rückmeldung ist angekommen.
            </p>
            <p className="leise">{a?.danke}</p>
            <div className="aktionen links">
              <button type="button" className="knopf" autoFocus onClick={onZu}>
                Schließen
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={sende}>
            <p className="leise">
              Sag uns, was nicht klappt, was dir fehlt oder was du besser erklärt haben möchtest. <HandbuchLink kapitel="fehler">Rückmeldung geben</HandbuchLink>
            </p>
            <fieldset className="melden-art">
              <legend>Worum geht es?</legend>
              {arten.map((x) => (
                <label key={x} className={art === x ? 'gewaehlt' : ''}>
                  <input type="radio" name="melden-art" checked={art === x} onChange={() => setArt(x)} />
                  <strong>{ARTEN[x].wahl}</strong>
                  <span className="leise klein">{ARTEN[x].wozu}</span>
                </label>
              ))}
            </fieldset>
            {art && a && (
              <>
                {art === 'inhalt' && bereiche && (
                  <>
                    <label htmlFor="melden-thema">Um welches Thema geht es?</label>
                    <select id="melden-thema" value={thema} onChange={(e) => setThema(e.target.value)}>
                      <option value="">Kein bestimmtes Thema</option>
                      {bereiche.map((b) =>
                        b.felder.map((f) => (
                          <optgroup key={`${b.bereich}|${f.id}`} label={bereiche.length > 1 ? `${b.titel}: ${f.titel}` : f.titel}>
                            <option value={`${b.bereich}|${f.id}|`}>{f.titel} – insgesamt</option>
                            {f.themen.map((t) => (
                              <option key={t.id} value={`${b.bereich}|${f.id}|${t.id}`}>
                                {t.titel}
                              </option>
                            ))}
                          </optgroup>
                        )),
                      )}
                    </select>
                  </>
                )}
                <label htmlFor="melden-text">{a.frage}</label>
                <textarea id="melden-text" rows={6} value={text} maxLength={MAX_TEXT} required minLength={10} autoFocus aria-describedby="melden-hilfe" placeholder={a.beispiel} onChange={(e) => setText(e.target.value)} />
                <p id="melden-hilfe" className="leise klein">
                  {a.hilfe} {text.length} von {MAX_TEXT} Zeichen.
                </p>
              </>
            )}
            {art === 'fehler' && (
            <fieldset className="melden-bild">
              <legend>Bildschirmfoto (freiwillig)</legend>
              {bild ? (
                <>
                  <img src={bild} alt="Vorschau des Bildschirmfotos, das mitgeschickt wird" />
                  <p className="hinweis klein">
                    <strong>Bitte ansehen, bevor du sendest:</strong> Der Betreiber des Portals sieht alles, was auf dem Bild steht – auch Texte aus Berichten oder Namen. Wenn etwas darauf nicht für ihn gedacht ist, entferne das Bild.
                  </p>
                  <button type="button" className="knopf schlicht klein gefahr" onClick={() => setBild(null)}>
                    Bild entfernen
                  </button>
                </>
              ) : (
                <>
                  <p className="leise klein">Ein Bild zeigt oft schneller als Worte, was nicht stimmt. Du siehst es vor dem Senden und kannst es wieder entfernen.</p>
                  <div className="aktionen links">
                    {kannAufnehmen() && (
                      <button type="button" className="knopf schlicht klein" onClick={() => void aufnehmen()}>
                        Bildschirmfoto aufnehmen
                      </button>
                    )}
                    <button type="button" className="knopf schlicht klein" onClick={() => datei.current?.click()}>
                      Bild auswählen
                    </button>
                  </div>
                  {kannAufnehmen() && <p className="leise klein">Beim Aufnehmen fragt der Browser, welches Fenster er zeigen darf – wähle dieses. Ein kopiertes Bild kannst du auch mit Strg + V einfügen.</p>}
                  <input
                    ref={datei}
                    type="file"
                    accept="image/*"
                    hidden
                    aria-label="Bild für die Fehlermeldung auswählen"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void nimmBild(() => ausDatei(f));
                    }}
                  />
                </>
              )}
            </fieldset>
            )}
            {art === 'inhalt' && (
              <p className="hinweis klein">
                <strong>Ohne deinen Namen.</strong> Die Ausbilder sehen deinen Text, das Thema und den Tag – nicht, von wem der Wunsch kommt. Gibt es in deinem Beruf nur wenige Azubis, lässt es sich trotzdem manchmal erraten.
              </p>
            )}
            {art && art !== 'inhalt' && (
              <details className="klapp melden-technik">
                <summary>Das wird automatisch mitgeschickt</summary>
                <dl>
                  <dt>Dein Name und deine Rolle</dt>
                  <dd>damit man nachfragen kann</dd>
                  <dt>Seite</dt>
                  <dd>{seite}</dd>
                  {art === 'fehler' && (
                    <>
                      <dt>Version</dt>
                      <dd>{version}</dd>
                      <dt>Fenstergröße</dt>
                      <dd>{fenster}</dd>
                      <dt>Browser</dt>
                      <dd>{navigator.userAgent}</dd>
                      <dt>Bildschirmfoto</dt>
                      <dd>{bild ? 'ja – siehe Vorschau oben' : 'nein'}</dd>
                      <dt>Letzte Fehlermeldungen des Browsers</dt>
                      <dd>{technik ? <pre>{technik}</pre> : 'keine'}</dd>
                    </>
                  )}
                  <dt>Wer liest das?</dt>
                  <dd>{art === 'fehler' ? 'der Betreiber des Portals (Super-Admin)' : 'der Betreiber des Portals (Super-Admin) und die Ausbilder'}</dd>
                </dl>
              </details>
            )}
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <div className="aktionen links">
              <button type="submit" className="knopf" disabled={laeuft || !art || text.trim().length < 10}>
                {laeuft ? 'Sendet …' : 'Rückmeldung senden'}
              </button>
              <button type="button" className="knopf schlicht" onClick={schliesse}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
