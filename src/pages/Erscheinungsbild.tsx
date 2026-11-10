import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api';

const MAX = 150 * 1024;

/** Logo des Betriebs – nur für den Super-Admin. */
export function Erscheinungsbild({ logo, onGeaendert }: { logo: string | null; onGeaendert: (logo: string | null) => void }) {
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  const waehle = (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    if (datei.size > MAX) return setMeldung({ text: `Die Datei ist ${Math.round(datei.size / 1024)} KB groß. Erlaubt sind höchstens 150 KB – bitte das Bild verkleinern.`, fehler: true });
    const leser = new FileReader();
    leser.onerror = () => setMeldung({ text: 'Die Datei ließ sich nicht lesen.', fehler: true });
    leser.onload = async () => {
      try {
        const r = await api<{ logo: string }>('PUT', '/api/branding/logo', { daten: leser.result });
        onGeaendert(r.logo);
        setMeldung({ text: 'Logo gespeichert. Es steht jetzt in der Kopfzeile und auf der Anmeldeseite.', fehler: false });
      } catch (err) {
        setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
      }
    };
    leser.readAsDataURL(datei);
  };
  const entferne = async () => {
    if (!window.confirm('Das Logo entfernen? Danach steht wieder das Standard-Symbol in der Kopfzeile.')) return;
    try {
      await api('DELETE', '/api/branding/logo');
      onGeaendert(null);
      setMeldung({ text: 'Logo entfernt.', fehler: false });
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <>
      <h1>Erscheinungsbild</h1>
      <p className="leise">Das Logo des Betriebs steht in der Kopfzeile und auf der Anmeldeseite. Der Name „Ausbildungsportal“ bleibt klein daneben stehen.</p>
      <section className="karte">
        <h2>Logo</h2>
        <div className="logo-vorschau" aria-label="Vorschau">
          {logo ? <img src={logo} alt="Aktuelles Logo" /> : <span className="leise">Kein Logo hinterlegt – es wird das Standard-Symbol gezeigt.</span>}
        </div>
        {meldung && (
          <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
            {meldung.text}
          </p>
        )}
        <label>
          {logo ? 'Anderes Bild wählen' : 'Bild wählen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={waehle} />
        </label>
        <p className="leise klein">PNG, JPEG oder WebP, höchstens 150 KB. Am besten ein Logo im Querformat mit durchsichtigem Hintergrund; es wird 32 Pixel hoch dargestellt und muss auf hellem und dunklem Hintergrund erkennbar sein.</p>
        {logo && (
          <button type="button" className="knopf schlicht gefahr" onClick={() => void entferne()}>
            Logo entfernen
          </button>
        )}
      </section>
    </>
  );
}
