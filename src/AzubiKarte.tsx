import { datum } from './api';
import type { AzubiKurz } from './api';
import { Avatar } from './avatar';
import { Icon } from './icons';
import { Link } from './router';


/** Anteil der Ausbildungszeit, der vorbei ist (0–100). */
function fortschritt(a: AzubiKurz): number | null {
  if (!a.beginn || !a.ende || a.phase === 'offen') return null;
  const von = Date.parse(a.beginn);
  const bis = Date.parse(a.ende);
  return Math.max(0, Math.min(100, Math.round(((Date.now() - von) / (bis - von)) * 100)));
}

/**
 * Ein Azubi als Karte – auf der Startseite und in der Azubi-Liste gleich aufgebaut:
 * oben wer, in der Mitte der Stand von Ausbildung und Berichten, unten immer dieselben drei Wege.
 */
export function AzubiKarte({ a }: { a: AzubiKurz }) {
  const anteil = fortschritt(a);
  const b = a.berichte;
  return (
    <li className="karte azubi-karte">
      <div className="azubi-kopf">
        <Avatar name={a.anzeigename} bild={a.bild} />
        <div className="azubi-name">
          <strong>{a.anzeigename}</strong>
          <span className="leise klein">{a.beruf || 'Beruf noch nicht eingetragen'}</span>
        </div>
        {a.betreuung === 'ohne' && <span className="pille gelb">ohne Ausbilder</span>}
        {a.betreuung === 'vertretung' && <span className="pille blau">Vertretung</span>}
        {a.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
      </div>

      <dl className="azubi-stand">
        <dt>Ausbildung</dt>
        <dd>
          {a.phase === 'offen' && <span className="leise">Ausbildungsbeginn fehlt – bitte im Profil eintragen</span>}
          {a.phase === 'vor' && `beginnt am ${datum(a.beginn)}`}
          {a.phase === 'beendet' && `beendet am ${datum(a.ende)}`}
          {a.phase === 'laufend' && (
            <>
              {a.ausbildungsjahr}. Ausbildungsjahr <span className="leise">· bis {datum(a.ende)}</span>
            </>
          )}
          {anteil !== null && a.phase === 'laufend' && (
            <div className="balken" role="img" aria-label={`${anteil} Prozent der Ausbildungszeit sind vorbei`}>
              <span style={{ width: `${anteil}%` }} />
            </div>
          )}
        </dd>
        <dt>Berichte</dt>
        <dd className="azubi-berichte">
          {a.phase === 'offen' ? (
            <span className="leise">–</span>
          ) : b.wartend + b.zurueck + b.fehlend === 0 ? (
            <span className="pille gruen">alles auf dem Stand</span>
          ) : (
            <>
              {b.wartend > 0 && <span className="pille blau">{b.wartend === 1 ? '1 wartet auf Abzeichnung' : `${b.wartend} warten auf Abzeichnung`}</span>}
              {b.zurueck > 0 && <span className="pille gelb">{b.zurueck} zurückgegeben</span>}
              {b.fehlend > 0 && <span className="pille rot">{b.fehlend === 1 ? '1 fehlt' : `${b.fehlend} fehlen`}</span>}
            </>
          )}
        </dd>
      </dl>

      <nav className="azubi-wege" aria-label={`Bereiche von ${a.anzeigename}`}>
        <Link zu={`/azubis/${a.id}`}>
          <Icon name="konto" groesse={18} />
          Profil
        </Link>
        <Link zu={`/azubis/${a.id}/plan`}>
          <Icon name="plan" groesse={18} />
          {/* in der schmalen Karte die Kurzform – wie „Plan“ in der Leiste unten */}
          Plan
        </Link>
        <Link zu={`/azubis/${a.id}/berichtsheft`}>
          <Icon name="heft" groesse={18} />
          Berichtsheft
        </Link>
        <Link zu={`/azubis/${a.id}/urlaub`}>
          <Icon name="urlaub" groesse={18} />
          Urlaub
        </Link>
      </nav>
    </li>
  );
}
