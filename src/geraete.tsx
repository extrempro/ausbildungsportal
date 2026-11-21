import { useEffect, useState } from 'react';
import { api, zeit } from './api';
import { melde, rueckfrage } from './dialoge';
import { HandbuchLink } from './handbuchLink';

/**
 * „Angemeldete Geräte“ unter Konto: wo man gerade angemeldet ist – und andere Geräte abmelden.
 * Jede Rolle sieht nur die eigenen Sitzungen. Zum Gerät steht nur Browser und System (keine IP-Adresse).
 */
interface Sitzung {
  id: string;
  geraet: string;
  erstellt: string;
  zuletzt: string;
  diese: boolean;
}

export function AngemeldeteGeraete() {
  const [liste, setListe] = useState<Sitzung[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    api<{ sitzungen: Sitzung[] }>('GET', '/api/ich/sitzungen')
      .then((r) => setListe(r.sitzungen))
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : 'Die Geräte konnten nicht geladen werden'));
  }, []);

  const tue = async (methode: 'DELETE' | 'POST', pfad: string, bestaetigung: string) => {
    setLaeuft(true);
    setFehler('');
    try {
      const r = await api<{ sitzungen: Sitzung[] }>(methode, pfad);
      setListe(r.sitzungen);
      melde(bestaetigung);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setLaeuft(false);
    }
  };
  const andereAbmelden = async () => {
    if (!(await rueckfrage('Auf allen anderen Geräten abmelden?\n\nDort musst du dich danach neu anmelden. Auf diesem Gerät bleibst du angemeldet.', { ja: 'Überall sonst abmelden' }))) return;
    await tue('POST', '/api/ich/sitzungen/andere-abmelden', 'Auf allen anderen Geräten abgemeldet.');
  };

  const andere = liste?.filter((s) => !s.diese).length ?? 0;
  return (
    <>
      <p className="leise">Hier bist du gerade angemeldet. Kennst du ein Gerät nicht oder hast du dich an einem fremden Gerät nicht abgemeldet, melde es hier ab.</p>
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {liste === null && !fehler && <p className="leise">Lädt …</p>}
      {liste && (
        <ul className="geraete-liste">
          {liste.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.geraet || 'Unbekanntes Gerät'}</strong>
                {s.diese && <span className="pille gruen">dieses Gerät</span>}
                <span className="leise klein geraete-zeit">
                  angemeldet seit {zeit(s.erstellt)} · zuletzt aktiv {zeit(s.zuletzt)}
                </span>
              </div>
              {!s.diese && (
                <button type="button" className="knopf schlicht klein" disabled={laeuft} onClick={() => void tue('DELETE', `/api/ich/sitzungen/${s.id}`, 'Gerät abgemeldet.')} aria-label={`${s.geraet || 'Unbekanntes Gerät'} abmelden`}>
                  Abmelden
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {liste && andere === 0 && <p className="leise klein">Du bist nur auf diesem Gerät angemeldet.</p>}
      {andere > 1 && (
        <div className="aktionen links">
          <button type="button" className="knopf schlicht" disabled={laeuft} onClick={() => void andereAbmelden()}>
            Überall sonst abmelden
          </button>
        </div>
      )}
      <p className="hilfe-zeile klein abstand-oben">
        <HandbuchLink kapitel="geraete">Angemeldete Geräte</HandbuchLink>
      </p>
    </>
  );
}
