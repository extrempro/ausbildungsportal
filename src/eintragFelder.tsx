import type { ReactNode } from 'react';
import { ART_TEXT, ROLLE_TEXT } from './api';
import type { PlanArt, Rolle, Unteraufgabe } from './api';

/**
 * Die Felder eines Plan-Eintrags – dieselben im Fenster des Ausbildungsplans und in der Sammelplanung,
 * damit ein Eintrag überall gleich aussieht und gleich heißt.
 */
export interface EintragWerte {
  art: PlanArt;
  titel: string;
  von: string;
  bis: string;
  text: string;
  zustaendigId: number | null;
  unteraufgaben: Unteraufgabe[];
  /** nur Termine */
  tag?: string;
  zeitVon?: string;
  zeitBis?: string;
}

const BEISPIEL: Record<PlanArt, string> = { schule: 'z. B. Berufsschule Block 2', einsatz: 'z. B. IT-Support', aufgabe: 'z. B. Arbeitsplatz einrichten', notiz: '', termin: 'z. B. JAV-Sitzung' };

export function EintragFelder({
  wert,
  setze,
  arten,
  personen,
  nachZustaendig,
  autoFokus = false,
}: {
  wert: EintragWerte;
  setze: (teil: Partial<EintragWerte>) => void;
  arten: readonly PlanArt[];
  personen: { id: number; anzeigename: string; rolle: Rolle }[];
  /** z. B. der Haken „dem Azubi zuweisen“ im Plan */
  nachZustaendig?: ReactNode;
  autoFokus?: boolean;
}) {
  const termin = wert.art === 'termin';
  const mitPerson = (wert.art === 'einsatz' || wert.art === 'aufgabe') && personen.length > 0;
  return (
    <>
      <label>
        Art
        <select value={wert.art} onChange={(ev) => setze({ art: ev.target.value as PlanArt })}>
          {arten.map((a) => (
            <option key={a} value={a}>
              {ART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="ganz">
        Titel
        <input value={wert.titel} maxLength={120} required autoFocus={autoFokus} onChange={(ev) => setze({ titel: ev.target.value })} placeholder={BEISPIEL[wert.art]} />
      </label>
      {termin ? (
        <>
          <p className="hinweis ganz">
            <strong>Wofür sind Termine?</strong> Für einzelne Tage, die du dir merken willst – zum Beispiel eine JAV-Sitzung (Jugend- und Auszubildendenvertretung), ein Gespräch mit der Personalabteilung oder eine Betriebsversammlung.{' '}
            <strong>Termine siehst nur du.</strong> Dein Ausbilder und deine Ausbildungsbeauftragten sehen sie nicht – auch nicht in ihrer Übersicht oder ihrem Kalender. Wenn sie von einem Termin wissen sollen, sag es ihnen selbst.
          </p>
          <label>
            Datum
            <input type="date" value={wert.tag ?? ''} required onChange={(ev) => setze({ tag: ev.target.value })} />
          </label>
          <label>
            Beginn (leer = ganzer Tag)
            <input type="time" value={wert.zeitVon ?? ''} onChange={(ev) => setze({ zeitVon: ev.target.value, ...(ev.target.value ? {} : { zeitBis: '' }) })} />
          </label>
          <label>
            Ende (freiwillig)
            <input type="time" value={wert.zeitBis ?? ''} disabled={!wert.zeitVon} min={wert.zeitVon || undefined} onChange={(ev) => setze({ zeitBis: ev.target.value })} />
          </label>
        </>
      ) : (
        <>
          <label>
            Von (Woche mit diesem Tag)
            <input type="date" value={wert.von} required onChange={(ev) => setze({ von: ev.target.value })} />
          </label>
          <label>
            Bis (leer = eine Woche)
            <input type="date" value={wert.bis} min={wert.von || undefined} onChange={(ev) => setze({ bis: ev.target.value })} />
          </label>
        </>
      )}
      {mitPerson && (
        <label>
          Zuständig
          <select value={wert.zustaendigId ?? ''} onChange={(ev) => setze({ zustaendigId: ev.target.value ? Number(ev.target.value) : null })}>
            <option value="">– niemand –</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.anzeigename} ({ROLLE_TEXT[p.rolle]})
              </option>
            ))}
          </select>
        </label>
      )}
      {nachZustaendig}
      <label className="ganz">
        {termin ? 'Ort oder Anmerkung (freiwillig)' : 'Beschreibung'}
        <textarea rows={termin ? 2 : 3} maxLength={2000} value={wert.text} onChange={(ev) => setze({ text: ev.target.value })} />
      </label>
      {wert.art === 'aufgabe' && (
        <div className="ganz">
          <strong className="klein">Unteraufgaben</strong>
          {wert.unteraufgaben.map((u, i) => (
            <div className="zeile zwei" key={i}>
              <input aria-label={`Unteraufgabe ${i + 1}`} value={u.text} maxLength={200} onChange={(ev) => setze({ unteraufgaben: wert.unteraufgaben.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)) })} />
              <button type="button" className="knopf schlicht" onClick={() => setze({ unteraufgaben: wert.unteraufgaben.filter((_, j) => j !== i) })}>
                Entfernen
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="knopf schlicht" disabled={wert.unteraufgaben.length >= 30} onClick={() => setze({ unteraufgaben: [...wert.unteraufgaben, { text: '', erledigt: false }] })}>
              Unteraufgabe hinzufügen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
