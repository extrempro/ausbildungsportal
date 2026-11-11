import { melde, rueckfrage } from '../dialoge';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Konto, ProfilAntwort, Theme } from '../api';
import { KalenderAbo } from '../kalenderAbo';
import { ProfilUebersicht } from './AzubiDetail';
import { UnterschriftBild, UnterschriftFeld } from '../unterschrift';
import { HandbuchLink } from '../handbuchLink';
import { Avatar } from '../avatar';

export function PasswortFormular({ onFertig }: { onFertig: () => void | Promise<void> }) {
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  const sende = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get('neu') !== f.get('wiederholung')) return setMeldung({ text: 'Die beiden neuen Passwörter stimmen nicht überein', fehler: true });
    try {
      await api('PUT', '/api/ich/passwort', { alt: f.get('alt'), neu: f.get('neu') });
      form.reset();
      setMeldung(null);
      melde('Passwort geändert. Andere Geräte wurden abgemeldet.');
      await onFertig();
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <form onSubmit={sende}>
      <label>
        Bisheriges Passwort
        <input name="alt" type="password" autoComplete="current-password" required />
      </label>
      <label>
        Neues Passwort (mindestens 14 Zeichen)
        <input name="neu" type="password" autoComplete="new-password" minLength={14} required />
      </label>
      <label>
        Neues Passwort wiederholen
        <input name="wiederholung" type="password" autoComplete="new-password" minLength={14} required />
      </label>
      {meldung && (
        <p className={`hinweis ${meldung.fehler ? 'fehler' : 'gut'}`} role={meldung.fehler ? 'alert' : 'status'}>
          {meldung.text}
        </p>
      )}
      <button className="knopf">Passwort ändern</button>
    </form>
  );
}

function Unterschrift({ konto }: { konto: Konto }) {
  const [gespeichert, setGespeichert] = useState<string | null | undefined>(undefined);
  const [neu, setNeu] = useState('');
  const [zeichnen, setZeichnen] = useState(false);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api<{ pfad: string | null }>('GET', '/api/ich/unterschrift').then((r) => setGespeichert(r.pfad), () => setGespeichert(null));
  }, []);

  const speichere = async () => {
    try {
      const r = await api<{ pfad: string }>('PUT', '/api/ich/unterschrift', { pfad: neu });
      setGespeichert(r.pfad);
      setZeichnen(false);
      setNeu('');
      setFehler('');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler');
    }
  };
  const loesche = async () => {
    if (!(await rueckfrage('Hinterlegte Unterschrift löschen?\n\nBereits unterschriebene Berichte bleiben unverändert. Zum Einreichen oder Abzeichnen brauchst du danach eine neue Unterschrift.', { ja: 'Unterschrift löschen', gefahr: true }))) return;
    await api('DELETE', '/api/ich/unterschrift');
    setGespeichert(null);
  };

  if (gespeichert === undefined) return <p className="leise">Lädt …</p>;
  return (
    <>
      <p className="leise klein">
        {konto.rolle === 'azubi'
          ? 'Unterschreibe hier einmal mit dem Finger, einem Stift oder der Maus. Wenn du einen Bericht einreichst, kommt diese Unterschrift darunter. Änderst du sie später, bleiben alte Berichte, wie sie sind.'
          : 'Mit dieser Unterschrift zeichnest du Berichte ab. Am Bericht wird eine Kopie gespeichert – eine spätere Änderung verändert alte Berichte nicht.'}
      </p>
      {gespeichert && !zeichnen && (
        <>
          <div className="signatur-feld gross">
            <UnterschriftBild pfad={gespeichert} titel="Meine Unterschrift" />
          </div>
          <div className="aktionen links">
            <button type="button" className="knopf schlicht" onClick={() => setZeichnen(true)}>
              Neu unterschreiben
            </button>
            <button type="button" className="knopf schlicht gefahr" onClick={() => void loesche()}>
              Unterschrift löschen
            </button>
          </div>
        </>
      )}
      {(!gespeichert || zeichnen) && (
        <>
          <UnterschriftFeld onAendern={setNeu} />
          {fehler && (
            <p className="hinweis fehler" role="alert">
              {fehler}
            </p>
          )}
          <div className="aktionen links">
            <button type="button" className="knopf" disabled={!neu} onClick={() => void speichere()}>
              Unterschrift speichern
            </button>
            {zeichnen && (
              <button type="button" className="knopf schlicht" onClick={() => setZeichnen(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Die Eckdaten der eigenen Ausbildung – gepflegt vom Ausbilder. */
function MeineAusbildung({ id }: { id: number }) {
  const [profil, setProfil] = useState<ProfilAntwort | null>(null);
  useEffect(() => {
    api<ProfilAntwort>('GET', `/api/azubis/${id}/profil`).then(setProfil, () => {});
  }, [id]);
  if (!profil) return <p className="leise">Lädt …</p>;
  return (
    <>
      <ProfilUebersicht p={profil} />
      <p className="leise klein">Diese Angaben trägt dein Ausbilder ein. Stimmt etwas nicht, sag ihm Bescheid.</p>
    </>
  );
}

export function KontoSeite({ konto, profilbild, onGeaendert }: { konto: Konto; profilbild: boolean; onGeaendert: () => void | Promise<void> }) {
  const [bildFehler, setBildFehler] = useState('');
  const [bildLaeuft, setBildLaeuft] = useState(false);
  const setzeBild = async (zeigen: boolean) => {
    // Abschalten löscht das Bild – deshalb vorher fragen
    if (!zeigen && konto.bild && !(await rueckfrage('Profilbild abschalten?\n\nDein Bild wird im Portal gelöscht. Statt des Bilds stehen dann deine Anfangsbuchstaben. Du kannst es jederzeit wieder einschalten.', { ja: 'Profilbild abschalten' }))) return;
    setBildLaeuft(true);
    setBildFehler('');
    try {
      await api('PUT', '/api/ich/bild', { zeigen });
      await onGeaendert();
      melde(zeigen ? 'Profilbild eingeschaltet. Es erscheint nach deiner nächsten Anmeldung.' : 'Profilbild abgeschaltet und gelöscht.');
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBildLaeuft(false);
    }
  };
  const setzeTheme = async (theme: Theme) => {
    await api('PUT', '/api/ich/theme', { theme });
    await onGeaendert();
  };

  return (
    <>
      <h1>Konto</h1>
      <p className="leise">Deine Angaben, dein Kalender-Abo, deine Unterschrift und die Darstellung des Portals. Was du hier änderst, gilt nur für dich.</p>
      <section className="karte">
        <dl className="daten">
          <dt>Name</dt>
          <dd>{konto.anzeigename}</dd>
          <dt>Anmeldename</dt>
          <dd>{konto.anmeldename}</dd>
          <dt>Rolle</dt>
          <dd>{ROLLE_TEXT[konto.rolle]}</dd>
          <dt>Anmeldung</dt>
          <dd>{konto.anmeldung === 'entra' ? 'über Microsoft (Passwort und Zwei-Faktor verwaltet Microsoft)' : 'lokal mit Passwort'}</dd>
          <dt>Letzte Anmeldung</dt>
          <dd>{zeit(konto.letzteAnmeldung)}</dd>
        </dl>
      </section>

      {profilbild && konto.anmeldung === 'entra' && (
        <section className="karte">
          <h2>Profilbild</h2>
          <div className="konto-bild">
            <Avatar name={konto.anzeigename} bild={konto.bild} />
            <div>
              <label className="haken">
                <input type="checkbox" checked={konto.bildZeigen} disabled={bildLaeuft} onChange={(e) => void setzeBild(e.target.checked)} />
                Mein Profilbild aus Microsoft 365 anzeigen
              </label>
              <p className="leise klein">
                {konto.bildZeigen
                  ? konto.bild
                    ? 'Das Portal holt dein Bild bei jeder Anmeldung aus Microsoft 365.'
                    : 'Im Moment gibt es kein Bild: Entweder hast du in Microsoft 365 keins hinterlegt, oder es kommt mit deiner nächsten Anmeldung.'
                  : 'Abgeschaltet: Das Portal speichert kein Bild von dir und zeigt deine Anfangsbuchstaben.'}{' '}
                <HandbuchLink kapitel="profilbild">Profilbild</HandbuchLink>
              </p>
            </div>
          </div>
          {bildFehler && (
            <p className="hinweis fehler" role="alert">
              {bildFehler}
            </p>
          )}
        </section>
      )}

      {konto.rolle === 'azubi' && (
        <section className="karte">
          <h2>Meine Ausbildung</h2>
          <MeineAusbildung id={konto.id} />
        </section>
      )}

      <section className="karte">
        <h2>Darstellung</h2>
        <label>
          Farbschema
          <select value={konto.theme} onChange={(e) => void setzeTheme(e.target.value as Theme)}>
            <option value="auto">Automatisch (System)</option>
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </label>
      </section>

      {konto.rolle !== 'admin' && (
        <section className="karte" id="kalender-abo">
          <h2>Kalender abonnieren</h2>
          <KalenderAbo konto={konto} />
        </section>
      )}

      {konto.rolle !== 'admin' && (
        <section className="karte">
          <h2>Unterschrift</h2>
          <Unterschrift konto={konto} />
          <p className="hilfe-zeile klein">
            <HandbuchLink kapitel={konto.rolle === 'azubi' ? 'konto' : 'unterschrift'}>{konto.rolle === 'azubi' ? 'Dein Konto und deine Unterschrift' : 'Unterschrift hinterlegen'}</HandbuchLink>
          </p>
        </section>
      )}

      {konto.anmeldung === 'lokal' && (
        <section className="karte">
          <h2>Passwort</h2>
          <PasswortFormular onFertig={onGeaendert} />
        </section>
      )}
    </>
  );
}
