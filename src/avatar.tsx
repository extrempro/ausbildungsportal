import { useEffect, useState } from 'react';

/** Anfangsbuchstaben eines Namens: „Anna Azubi“ → „AA“ */
export function initialenVon(name: string): string {
  return name
    .split(/\s+/)
    .map((t) => t[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Rundes Profilbild einer Person – oder ihre Anfangsbuchstaben, wenn es kein Bild gibt oder es sich nicht laden lässt.
 * Schmuck neben dem Namen: Vorleseprogramme überspringen es.
 */
export function Avatar({ name, bild }: { name: string; bild?: string | null }) {
  const [kaputt, setKaputt] = useState(false);
  useEffect(() => setKaputt(false), [bild]);
  return (
    <span className="avatar" aria-hidden="true">
      {bild && !kaputt ? <img src={bild} alt="" width="36" height="36" onError={() => setKaputt(true)} /> : initialenVon(name)}
    </span>
  );
}
