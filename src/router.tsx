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

export function Link({ zu, children, className }: { zu: string; children: ReactNode; className?: string }) {
  const aktiv = usePfad() === zu;
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
