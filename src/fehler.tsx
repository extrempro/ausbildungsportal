import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, FormEvent } from 'react';
import { api } from './api';

/**
 * „Fehler melden“: kurzer Text vom Menschen, dazu automatisch ein paar technische Angaben,
 * damit sich das Problem nachstellen lässt. Lesen kann die Meldungen nur der Super-Admin.
 */
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

export function FehlerMelden({ version, onZu }: { version: string; onZu: () => void }) {
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [bild, setBild] = useState<string | null>(null);
  // während der Aufnahme ist das Fenster unsichtbar, damit es nicht selbst auf dem Bild landet
  const [nimmtAuf, setNimmtAuf] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const flaeche = useRef<HTMLElement>(null);
  // wohin der Fokus nach dem Schließen zurückgeht – beim ersten Rendern gemerkt, bevor das Textfeld ihn bekommt
  const vorher = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const seite = window.location.pathname;
  const fenster = `${window.innerWidth} × ${window.innerHeight}`;
  const technik = letzteFehler.join('\n');

  useEffect(() => {
    document.body.classList.add('dialog-offen');
    const zurueck = vorher.current;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onZu();
      if (e.key !== 'Tab' || !flaeche.current) return;
      const ziele = [...flaeche.current.querySelectorAll<HTMLElement>('button, textarea, summary, a[href]')].filter((el) => !el.hasAttribute('disabled') && !el.hidden);
      const erstes = ziele[0];
      const letztes = ziele.at(-1);
      if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault();
        letztes?.focus();
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault();
        erstes?.focus();
      }
    };
    window.addEventListener('keydown', taste);
    return () => {
      window.removeEventListener('keydown', taste);
      document.body.classList.remove('dialog-offen');
      zurueck?.focus?.();
    };
  }, [onZu]);

  const sende = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      await api('POST', '/api/fehlermeldungen', { text, seite, fenster, technik, bild });
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
    <div className={`dialog-hintergrund${nimmtAuf ? ' unsichtbar' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onZu()}>
      <section ref={flaeche} className="karte dialog melden" role="dialog" aria-modal="true" aria-labelledby="melden-titel" onPaste={fertig ? undefined : einfuegen}>
        <h2 id="melden-titel">Fehler melden</h2>
        {fertig ? (
          <>
            <p className="hinweis gut" role="status">
              Danke! Deine Meldung ist angekommen.
            </p>
            <p className="leise">Der Betreiber des Portals sieht sie und kümmert sich darum. Eine Antwort bekommst du hier im Portal nicht – wenn es eilt, sprich bitte zusätzlich deinen Ausbilder an.</p>
            <div className="knopfzeile">
              <button type="button" className="knopf" autoFocus onClick={onZu}>
                Schließen
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={sende}>
            <p className="leise">Etwas funktioniert nicht oder sieht falsch aus? Beschreibe es kurz. Die Meldung geht an den Betreiber des Portals.</p>
            <label htmlFor="melden-text">Was ist passiert?</label>
            <textarea
              id="melden-text"
              rows={6}
              value={text}
              maxLength={MAX_TEXT}
              required
              minLength={10}
              autoFocus
              aria-describedby="melden-hilfe"
              placeholder={'Zum Beispiel: Ich wollte meinen Bericht einreichen. Nach dem Klick auf „Einreichen“ passiert nichts.'}
              onChange={(e) => setText(e.target.value)}
            />
            <p id="melden-hilfe" className="leise klein">
              Hilfreich ist: Was wolltest du tun? Was ist stattdessen passiert? Bitte schreibe keine Inhalte aus Berichten und keine Passwörter hinein. {text.length} von {MAX_TEXT} Zeichen.
            </p>
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
                  <div className="knopfzeile">
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
            <details className="melden-technik">
              <summary>Das wird automatisch mitgeschickt</summary>
              <dl>
                <dt>Dein Name und deine Rolle</dt>
                <dd>damit man nachfragen kann</dd>
                <dt>Seite</dt>
                <dd>{seite}</dd>
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
              </dl>
            </details>
            {fehler && (
              <p className="hinweis fehler" role="alert">
                {fehler}
              </p>
            )}
            <div className="knopfzeile">
              <button type="submit" className="knopf" disabled={laeuft || text.trim().length < 10}>
                {laeuft ? 'Sendet …' : 'Meldung senden'}
              </button>
              <button type="button" className="knopf schlicht" onClick={onZu}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
