import { Icon } from './icons';

/**
 * Verweis aus einem Fenster oder Formular auf ein Kapitel im Handbuch – überall gleich gestaltet.
 * Öffnet in einem neuen Fenster, damit angefangene Eingaben stehen bleiben.
 * Regel (docs/bedienregeln.md): In Fenstern und Formularen steht höchstens der eine Satz, den man zum Entscheiden braucht;
 * alles Weitere steht im Handbuch.
 */
export function HandbuchLink({ kapitel, children }: { kapitel: string; children: string }) {
  return (
    <a className="handbuch-link" href={`/handbuch#kapitel-${kapitel}`} target="_blank" rel="noopener">
      <Icon name="hilfe" groesse={18} />
      <span>
        Im Handbuch: {children}
        <span className="nur-vorleser"> (öffnet in neuem Fenster)</span>
      </span>
    </a>
  );
}
