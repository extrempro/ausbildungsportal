import { useCallback, useEffect, useState } from 'react';
import { api, ART_TEXT, berufName, PLAN_ARTEN } from '../api';
import type { PlanArt, Planvorlage, VorlageEintrag } from '../api';
import { Link } from '../router';

interface Berufe {
  id: number;
  bezeichnung: string;
  fachrichtung: string;
}
interface Zeile extends Omit<VorlageEintrag, 'unteraufgaben'> {
  /** eine Unteraufgabe je Zeile */
  unteraufgaben: string;
}

function VorlageFormular({ vorlage, berufe, onFertig }: { vorlage: Planvorlage | null; berufe: Berufe[]; onFertig: () => Promise<void> }) {
  const [titel, setTitel] = useState(vorlage?.titel ?? '');
  const [berufId, setBerufId] = useState<number | null>(vorlage?.berufId ?? null);
  const [zeilen, setZeilen] = useState<Zeile[]>((vorlage?.eintraege ?? []).map((e) => ({ ...e, unteraufgaben: e.unteraufgaben.join('\n') })));
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const aendere = (i: number, teil: Partial<Zeile>) => setZeilen(zeilen.map((z, j) => (j === i ? { ...z, ...teil } : z)));

  const speichere = async () => {
    const body = { titel, berufId, eintraege: zeilen.map((z) => ({ ...z, unteraufgaben: z.art === 'aufgabe' ? z.unteraufgaben.split('\n').map((t) => t.trim()).filter(Boolean) : [] })) };
    try {
      if (vorlage) await api('PUT', `/api/planvorlagen/${vorlage.id}`, body);
      else await api('POST', '/api/planvorlagen', body);
      await onFertig();
      if (vorlage) setMeldung({ text: 'Gespeichert.', fehler: false });
      else {
        setTitel('');
        setZeilen([]);
        setMeldung({ text: 'Vorlage angelegt.', fehler: false });
      }
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
    }
  };
  const loesche = async () => {
    if (!vorlage || !window.confirm(`Vorlage „${vorlage.titel}“ löschen? Schon übernommene Einträge in Plänen bleiben erhalten.`)) return;
    await api('DELETE', `/api/planvorlagen/${vorlage.id}`);
    await onFertig();
  };

  return (
    <>
      <div className="reihe">
        <label>
          Titel
          <input value={titel} maxLength={120} onChange={(e) => setTitel(e.target.value)} />
        </label>
        <label>
          Beruf
          <select value={berufId ?? ''} onChange={(e) => setBerufId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">für alle Berufe</option>
            {berufe.map((b) => (
              <option key={b.id} value={b.id}>
                {berufName(b)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {zeilen.map((z, i) => (
        <fieldset className="abschnitt" key={i}>
          <legend>Eintrag {i + 1}</legend>
          <div className="reihe">
            <label>
              Art
              <select value={z.art} onChange={(e) => aendere(i, { art: e.target.value as PlanArt })}>
                {PLAN_ARTEN.map((a) => (
                  <option key={a} value={a}>
                    {ART_TEXT[a]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ab Ausbildungswoche
              <input type="number" min={1} max={260} value={z.abWoche} onChange={(e) => aendere(i, { abWoche: Number(e.target.value) })} />
            </label>
            <label>
              Dauer in Wochen
              <input type="number" min={1} max={160} value={z.wochen} onChange={(e) => aendere(i, { wochen: Number(e.target.value) })} />
            </label>
            <label className="ganz">
              Titel
              <input value={z.titel} maxLength={120} onChange={(e) => aendere(i, { titel: e.target.value })} />
            </label>
            <label className="ganz">
              Beschreibung
              <textarea rows={2} maxLength={2000} value={z.text} onChange={(e) => aendere(i, { text: e.target.value })} />
            </label>
            {z.art === 'aufgabe' && (
              <label className="ganz">
                Unteraufgaben (eine je Zeile)
                <textarea rows={3} value={z.unteraufgaben} onChange={(e) => aendere(i, { unteraufgaben: e.target.value })} />
              </label>
            )}
          </div>
          <button type="button" className="knopf schlicht gefahr" onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}>
            Eintrag entfernen
          </button>
        </fieldset>
      ))}
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}
      <div className="aktionen links">
        <button
          type="button"
          className="knopf schlicht"
          disabled={zeilen.length >= 100}
          onClick={() => {
            const letzte = zeilen[zeilen.length - 1];
            setZeilen([...zeilen, { art: 'einsatz', abWoche: letzte ? letzte.abWoche + letzte.wochen : 1, wochen: 4, titel: '', text: '', unteraufgaben: '' }]);
          }}
        >
          Eintrag hinzufügen
        </button>
        <button type="button" className="knopf" disabled={!titel.trim()} onClick={() => void speichere()}>
          {vorlage ? 'Vorlage speichern' : 'Vorlage anlegen'}
        </button>
        {vorlage && (
          <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
            Vorlage löschen
          </button>
        )}
      </div>
    </>
  );
}

/** Planvorlagen: Abläufe in Wochen ab Ausbildungsbeginn, die sich in den Plan eines Azubis übernehmen lassen. */
export function Vorlagen() {
  const [d, setD] = useState<{ vorlagen: Planvorlage[]; berufe: Berufe[] } | null>(null);
  const [fehler, setFehler] = useState('');
  const lade = useCallback(async () => {
    setD(await api('GET', '/api/planvorlagen'));
  }, []);
  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
  }, [lade]);

  if (fehler) return <p className="hinweis fehler">{fehler}</p>;
  if (!d) return <p className="leise">Lädt …</p>;
  return (
    <>
      <p className="klein">
        <Link zu="/verwaltung/stammdaten">← Stammdaten</Link>
      </p>
      <h1>Planvorlagen</h1>
      <p className="leise">
        Eine Vorlage beschreibt einen Ablauf in Wochen ab Ausbildungsbeginn, z. B. „Woche 1–8 Einsatz IT-Support“. Im Ausbildungsplan eines Azubis lässt sie sich übernehmen; danach ist dessen Plan unabhängig von der Vorlage.
      </p>
      {d.vorlagen.map((v) => (
        <details className="karte" key={v.id}>
          <summary>
            {v.titel} <span className="leise klein">· {v.eintraege.length} Einträge · {berufName(d.berufe.find((b) => b.id === v.berufId)) || 'alle Berufe'}</span>
          </summary>
          <VorlageFormular vorlage={v} berufe={d.berufe} onFertig={lade} />
        </details>
      ))}
      <section className="karte">
        <h2>Neue Vorlage</h2>
        <VorlageFormular key={d.vorlagen.length} vorlage={null} berufe={d.berufe} onFertig={lade} />
      </section>
    </>
  );
}
