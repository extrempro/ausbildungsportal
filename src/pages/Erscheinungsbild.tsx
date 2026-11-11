import { melde, rueckfrage } from '../dialoge';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api';
import type { Logos } from '../api';

const MAX = 150 * 1024;
type Schema = 'hell' | 'dunkel';

function LogoFeld({ schema, logo, ersatz, onGeaendert }: { schema: Schema; logo: string | null; ersatz: string | null; onGeaendert: (l: Logos) => void }) {
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const name = schema === 'hell' ? 'helle' : 'dunkle';

  const waehle = (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    if (datei.size > MAX) return setMeldung({ text: `Die Datei ist ${Math.round(datei.size / 1024)} KB groß. Erlaubt sind höchstens 150 KB – bitte das Bild verkleinern.`, fehler: true });
    const leser = new FileReader();
    leser.onerror = () => setMeldung({ text: 'Die Datei ließ sich nicht lesen.', fehler: true });
    leser.onload = async () => {
      try {
        onGeaendert(await api<Logos>('PUT', '/api/branding/logo', { daten: leser.result, schema }));
        setMeldung(null);
        melde(`Logo für die ${name} Darstellung gespeichert.`);
      } catch (err) {
        setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
      }
    };
    leser.readAsDataURL(datei);
  };
  const entferne = async () => {
    if (!(await rueckfrage(`Das Logo für die ${name} Darstellung entfernen?\n\nIn der Kopfzeile und auf der Anmeldeseite steht dann wieder das Zeichen des Portals.`, { ja: 'Logo entfernen', gefahr: true }))) return;
    try {
      onGeaendert(await api<Logos>('DELETE', `/api/branding/logo?schema=${schema}`));
      setMeldung(null);
      melde('Logo entfernt.');
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <section className="karte">
      <h2>Logo für die {name} Darstellung</h2>
      <div className={`logo-vorschau ${schema}`} aria-label={`Vorschau auf ${schema === 'hell' ? 'hellem' : 'dunklem'} Hintergrund`}>
        {logo ? (
          <img src={logo} alt={`Logo für die ${name} Darstellung`} />
        ) : ersatz ? (
          <>
            <img src={ersatz} alt="Logo der hellen Darstellung" />
            <span>Kein eigenes Logo – hier wird das Logo der hellen Darstellung gezeigt.</span>
          </>
        ) : (
          <span>Kein Logo hinterlegt – es wird das Standard-Symbol gezeigt.</span>
        )}
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
      <p className="leise klein">
        {schema === 'hell' ? 'Für hellen Hintergrund: am besten dunkle Schrift oder ein farbiges Logo.' : 'Für dunklen Hintergrund: am besten die helle oder weiße Fassung des Logos. Ohne eigenes Bild wird das Logo der hellen Darstellung verwendet.'}
      </p>
      {logo && (
        <button type="button" className="knopf schlicht gefahr" onClick={() => void entferne()}>
          Logo entfernen
        </button>
      )}
    </section>
  );
}

/** Logo des Betriebs – nur für den Super-Admin. Je eines für die helle und die dunkle Darstellung. */
export function Erscheinungsbild({ logos, onGeaendert }: { logos: Logos; onGeaendert: (l: Logos) => void }) {
  return (
    <>
      <h1>Erscheinungsbild</h1>
      <p className="leise">
        Das Logo des Betriebs steht in der Kopfzeile und auf der Anmeldeseite. Der Name „Ausbildungsportal“ bleibt klein daneben stehen. PNG, JPEG oder WebP, höchstens 150 KB; am besten im Querformat mit durchsichtigem
        Hintergrund. Es wird 32 Pixel hoch dargestellt.
      </p>
      <LogoFeld schema="hell" logo={logos.logo} ersatz={null} onGeaendert={onGeaendert} />
      <LogoFeld schema="dunkel" logo={logos.logoDunkel} ersatz={logos.logo} onGeaendert={onGeaendert} />
    </>
  );
}
