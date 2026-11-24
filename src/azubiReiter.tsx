import type { Rolle } from './api';
import { Link } from './router';

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

/** Zurück-Link über den Seiten eines Azubis – eine Ebene höher ist die Liste aller Azubis. */
export function ZurueckZuAzubis() {
  return (
    <p className="klein nicht-drucken">
      <Link zu="/azubis">← Alle Azubis</Link>
    </p>
  );
}
