import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ROLLE_TEXT, zeit } from '../api';
import type { Konto, Theme } from '../api';

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
      setMeldung({ text: 'Passwort geändert. Andere Geräte wurden abgemeldet.', fehler: false });
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

export function KontoSeite({ konto, onGeaendert }: { konto: Konto; onGeaendert: () => void | Promise<void> }) {
  const setzeTheme = async (theme: Theme) => {
    await api('PUT', '/api/ich/theme', { theme });
    await onGeaendert();
  };

  return (
    <>
      <h1>Konto</h1>
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

      {konto.anmeldung === 'lokal' && (
        <section className="karte">
          <h2>Passwort</h2>
          <PasswortFormular onFertig={onGeaendert} />
        </section>
      )}
    </>
  );
}
