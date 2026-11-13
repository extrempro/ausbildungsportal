/**
 * WCAG 2.4.11 „Fokus nicht verdeckt“: Angeheftete Leisten (Kopfzeile, Leiste unten, Legende des Plans, Zeile „Inhalt“ …)
 * dürfen nie das Element verdecken, das gerade den Fokus hat. Der Browser rollt ein fokussiertes Element zwar ins Bild,
 * kennt die angehefteten Leisten aber nicht – deshalb rollt dieser Helfer danach so weit nach, dass es frei steht.
 * Nur über JavaScript, damit Sprungmarken (#kapitel-…, #kw-…) mit ihren eigenen Abständen unverändert bleiben.
 */
const LEISTEN = '.leiste, .tabs, .plan-legende, .plan-inhalt, .lern-navi-klapp, details.handbuch-inhalt, .abz-leiste.aktiv, .bericht-leiste';
const LUFT = 8;

/** Wie viel oben und unten von angehefteten Leisten belegt ist – ohne die Leiste, in der das Element selbst steht. */
function freiRaum(el: HTMLElement): { oben: number; unten: number } {
  let oben = 0;
  let unten = window.innerHeight;
  for (const leiste of document.querySelectorAll<HTMLElement>(LEISTEN)) {
    if (leiste.contains(el)) continue;
    const cs = getComputedStyle(leiste);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = leiste.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) continue;
    // nach Lage: Wer im unteren Teil am Rand klebt, verdeckt von unten (Leiste unten, Leiste des Berichts darüber);
    // wer oben am Rand bzw. unter einer anderen Leiste klebt, von oben. Eine angeheftete Leiste, die gerade noch im Fluss
    // der Seite steht (z. B. „Inhalt“ weiter unten), liegt nicht am Rand und zählt nicht.
    if (r.top > window.innerHeight / 2) {
      if (r.bottom >= window.innerHeight - 120) unten = Math.min(unten, r.top);
    } else if (r.top <= oben + 2 + (cs.position === 'sticky' ? 120 : 0) && r.bottom < window.innerHeight / 2) {
      oben = Math.max(oben, r.bottom);
    }
  }
  return { oben, unten };
}

export function halteFokusFrei(): () => void {
  const pruefe = (e: FocusEvent) => {
    const el = e.target;
    // in den immer festen Leisten (Kopfzeile, Leiste unten) und in Fenstern gibt es nichts zu rollen
    if (!(el instanceof HTMLElement) || el.closest('.leiste, .tabs') || el.closest('[role=dialog],[role=alertdialog]')) return;
    // erst nach dem eigenen Rollen des Browsers messen
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      const r = el.getBoundingClientRect();
      const { oben, unten } = freiRaum(el);
      if (r.top < oben + LUFT) window.scrollBy({ top: r.top - oben - LUFT });
      else if (r.bottom > unten - LUFT && r.height < unten - oben) window.scrollBy({ top: r.bottom - unten + LUFT });
    });
  };
  document.addEventListener('focusin', pruefe);
  return () => document.removeEventListener('focusin', pruefe);
}
