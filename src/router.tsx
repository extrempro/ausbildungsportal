import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

/** Kleine Seitensteuerung über die History-API. Wird mit Phase 3 durch React Router ersetzt. */
function abonniere(fn: () => void): () => void {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

export function usePfad(): string {
  return useSyncExternalStore(abonniere, () => window.location.pathname);
}

export function geheZu(pfad: string): void {
  if (pfad !== window.location.pathname + window.location.search) window.history.pushState(null, '', pfad);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

/** aktivAb: der Link gilt auch auf Unterseiten als aktiv (z. B. /azubis/12 für „Azubis“). */
export function Link({ zu, children, className, aktivAb }: { zu: string; children: ReactNode; className?: string; aktivAb?: string }) {
  const pfad = usePfad();
  const aktiv = pfad === zu || (!!aktivAb && pfad.startsWith(`${aktivAb}/`));
  return (
    <a
      href={zu}
      className={className}
      aria-current={aktiv ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        geheZu(zu);
      }}
    >
      {children}
    </a>
  );
}
