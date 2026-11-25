import { useEffect, useState } from 'react';
import { api } from './api';
import type { Rolle } from './api';
import { geheZu, Link } from './router';

// Rolle des angemeldeten Kontos – setzt App.tsx bei jedem Zeichnen (die Zeitleiste gibt es nur für Ausbilder)
let rolle: Rolle | null = null;
export function merkeRolle(r: Rolle): void {
  rolle = r;
}
/** Sieht das angemeldete Konto die Zeitleiste? (Reiter und Azubi-Karte) */
export const zeigtZeitleiste = () => rolle === 'ausbilder';

/**
 * Die gleichrangigen Seiten eines Azubis für Ausbilder und Beauftragte: Profil, Ausbildungsplan, Berichtsheft, Urlaub –
 * für Ausbilder dazu die Zeitleiste.
 * Steht auf jeder dieser Seiten gleich unter der Überschrift (docs/bedienregeln.md: Reiter nur zwischen gleichrangigen Seiten).
 */
export function AzubiReiter({ id, name }: { id: number; name: string }) {
  return (
    <nav className="reiter nicht-drucken" aria-label={`Bereiche von ${name}`}>
      <Link zu={`/azubis/${id}`}>Profil</Link>
      <Link zu={`/azubis/${id}/plan`}>Ausbildungsplan</Link>
      <Link zu={`/azubis/${id}/berichtsheft`}>Berichtsheft</Link>
      <Link zu={`/azubis/${id}/urlaub`}>Urlaub</Link>
      {zeigtZeitleiste() && <Link zu={`/azubis/${id}/zeitleiste`}>Zeitleiste</Link>}
    </nav>
  );
}

// die Azubis, zwischen denen man blättert – einmal geholt, eine Minute gemerkt (Reihenfolge wie unter „Azubis“)
let liste: { zeit: number; laedt: Promise<{ id: number; anzeigename: string }[]> } | null = null;
function azubiListe(): Promise<{ id: number; anzeigename: string }[]> {
  if (!liste || Date.now() - liste.zeit > 60_000) {
    const laedt = api<{ azubis: { id: number; anzeigename: string }[] }>('GET', '/api/azubis').then(
      (r) => r.azubis.map((a) => ({ id: a.id, anzeigename: a.anzeigename })),
      () => [],
    );
    liste = { zeit: Date.now(), laedt };
  }
  return liste.laedt;
}

/**
 * Zwischen den Azubis blättern (Ausbilder, Beauftragte): vorheriger, Auswahl, nächster – auf derselben Seite des anderen Azubis
 * (gleicher Reiter, im Bericht dieselbe Woche). Reihenfolge wie unter „Azubis“; am Ende geht es wieder von vorn los.
 * Ungespeichertes fragt wie jeder Seitenwechsel nach (geheZu).
 */
export function AzubiWechsel({ id }: { id: number }) {
  const [azubis, setAzubis] = useState<{ id: number; anzeigename: string }[]>([]);
  useEffect(() => {
    let aktiv = true;
    void azubiListe().then((l) => aktiv && setAzubis(l));
    return () => {
      aktiv = false;
    };
  }, []);
  const i = azubis.findIndex((a) => a.id === id);
  if (azubis.length < 2 || i < 0) return null;
  const vor = azubis[(i - 1 + azubis.length) % azubis.length];
  const nach = azubis[(i + 1) % azubis.length];
  const zu = (neu: number) => geheZu(window.location.pathname.replace(new RegExp(`^/azubis/${id}(?=/|$)`), `/azubis/${neu}`) + window.location.search);
  return (
    <nav className="azubi-wechsel" aria-label="Anderer Azubi">
      <button type="button" className="knopf schlicht klein" aria-label={`Vorheriger Azubi: ${vor.anzeigename}`} onClick={() => zu(vor.id)}>
        <span aria-hidden="true">‹</span> <span className="nur-breit">{vor.anzeigename}</span>
      </button>
      <label>
        <span className="nur-vorleser">Azubi wählen</span>
        <select value={id} onChange={(e) => zu(Number(e.target.value))}>
          {azubis.map((a) => (
            <option key={a.id} value={a.id}>
              {a.anzeigename}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="knopf schlicht klein" aria-label={`Nächster Azubi: ${nach.anzeigename}`} onClick={() => zu(nach.id)}>
        <span className="nur-breit">{nach.anzeigename}</span> <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}

/** Zurück-Link über den Seiten eines Azubis – eine Ebene höher ist die Liste aller Azubis; daneben der Wechsel zu anderen Azubis. */
export function ZurueckZuAzubis({ id }: { id: number }) {
  return (
    <div className="azubi-kopfzeile nicht-drucken">
      <p className="klein">
        <Link zu="/azubis">← Alle Azubis</Link>
      </p>
      <AzubiWechsel id={id} />
    </div>
  );
}
