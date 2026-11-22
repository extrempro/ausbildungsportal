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
      // Was höher ist als der freie Platz, passt ohnehin nicht ganz hinein – nicht rollen. Das betrifft vor allem
      // <main tabindex="-1">: Safari gibt einem angeklickten Knopf keinen Fokus, sondern dem nächsten fokussierbaren
      // Element darüber. Früher sprang die Seite dann an den Anfang (z. B. bei „Tätigkeit im Betrieb eintragen“).
      if (r.height >= unten - oben - 2 * LUFT) return;
      if (r.top < oben + LUFT) window.scrollBy({ top: r.top - oben - LUFT });
      else if (r.bottom > unten - LUFT) window.scrollBy({ top: r.bottom - unten + LUFT });
    });
  };
  document.addEventListener('focusin', pruefe);
  return () => document.removeEventListener('focusin', pruefe);
}

/**
 * Rückmeldungen sind immer zu sehen – am PC, am Tablet und am Handy. Kurze Bestätigungen („Gespeichert“) kommen über
 * `melde()` und stehen ohnehin fest unten im Bild. Rückmeldungen an der Stelle (Fehler `.hinweis.fehler` mit
 * `role="alert"`, Ergebnisse `.hinweis` mit `role="status"`, alles mit `data-rueckmeldung`) stehen dagegen im Text der
 * Seite und lagen auf langen Seiten bisher oft außerhalb des Bildes. Dieser Helfer rollt eine neu erschienene oder
 * geänderte Rückmeldung so weit ins Bild, dass sie frei von angehefteten Leisten steht.
 * Nur als Antwort auf eine Handlung (Klick, Taste, Absenden) auf derselben Seite – beim Öffnen einer Seite springt nichts.
 */
const RUECKMELDUNG = '[role=alert], .hinweis[role=status], [data-rueckmeldung]';
const NACH_HANDLUNG_MS = 15_000;

export function halteRueckmeldungSichtbar(): () => void {
  let handlung = { zeit: 0, pfad: '' };
  const merke = () => {
    handlung = { zeit: Date.now(), pfad: location.pathname };
  };
  const zeige = (el: HTMLElement) => {
    // feste Meldungen unten und Fenster liegen schon im Bild
    if (el.closest('.meldungen, [role=dialog], [role=alertdialog]')) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // eingeklappt oder ausgeblendet
    const { oben, unten } = freiRaum(el);
    const platz = unten - oben - 2 * LUFT;
    // Höheres steht mit seinem Anfang oben im Bild – dort steht das Wichtigste
    let weg = 0;
    if (r.top < oben + LUFT || r.height >= platz) weg = r.top - oben - LUFT;
    else if (r.bottom > unten - LUFT) weg = r.bottom - unten + LUFT;
    // Wer gerade tippt, behält sein Feld im Bild (Hinweise, die beim Eingeben erscheinen, z. B. „zu viel geplant“)
    const feld = document.activeElement;
    if (weg > 0 && feld instanceof HTMLElement && feld.matches('input, textarea, select') && !el.contains(feld)) {
      weg = Math.min(weg, Math.max(0, feld.getBoundingClientRect().top - oben - LUFT));
    }
    if (weg !== 0) window.scrollBy({ top: weg });
  };
  const beobachter = new MutationObserver((aenderungen) => {
    if (Date.now() - handlung.zeit > NACH_HANDLUNG_MS || location.pathname !== handlung.pfad) return;
    const gefunden = new Set<HTMLElement>();
    for (const a of aenderungen) {
      const knoten = a.type === 'characterData' ? a.target.parentElement : a.target;
      if (knoten instanceof HTMLElement) {
        // neuer Text in einer Rückmeldung, die schon da war (z. B. ein anderer Fehler beim zweiten Versuch)
        const um = knoten.closest<HTMLElement>(RUECKMELDUNG);
        if (um && (a.type === 'characterData' || a.addedNodes.length > 0)) gefunden.add(um);
      }
      for (const n of a.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches(RUECKMELDUNG)) gefunden.add(n);
        for (const k of n.querySelectorAll<HTMLElement>(RUECKMELDUNG)) gefunden.add(k);
      }
    }
    if (gefunden.size === 0) return;
    // die oberste zuerst: Bei mehreren zeigt der Anfang, wo es losgeht
    const erste = [...gefunden].filter((el) => el.isConnected).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (erste) requestAnimationFrame(() => erste.isConnected && zeige(erste));
  });
  beobachter.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('pointerdown', merke, true);
  document.addEventListener('keydown', merke, true);
  document.addEventListener('submit', merke, true);
  return () => {
    beobachter.disconnect();
    document.removeEventListener('pointerdown', merke, true);
    document.removeEventListener('keydown', merke, true);
    document.removeEventListener('submit', merke, true);
  };
}

/**
 * Am Handy schiebt sich die Bildschirmtastatur über den unteren Rand. `--tastatur` sagt, wie viel sie verdeckt, damit
 * feste Meldungen unten (`melde()`) darüber stehen und nicht dahinter.
 */
export function halteTastaturFrei(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const setze = () => {
    const verdeckt = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--tastatur', `${verdeckt}px`);
  };
  setze();
  vv.addEventListener('resize', setze);
  vv.addEventListener('scroll', setze);
  return () => {
    vv.removeEventListener('resize', setze);
    vv.removeEventListener('scroll', setze);
  };
}
