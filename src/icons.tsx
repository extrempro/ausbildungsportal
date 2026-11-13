/** Kleine Strich-Symbole für die Navigation – selbst gezeichnet, keine Abhängigkeit. Immer zusätzlich zu einem Text, nie allein. */
const PFADE = {
  start: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5',
  heft: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h4',
  plan: 'M4 6h16v14H4zM4 10.5h16M8 3.5v4M16 3.5v4M8 14.5h3M13 14.5h3',
  azubis: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2A6.5 6.5 0 0 1 21.5 20',
  abzeichnen: 'M4 4h16v16H4zM8 12.5l3 3 5-6.5',
  uebersicht: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  mehr: 'M4 6.5h16M4 12h16M4 17.5h16',
  konten: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M17.5 8v6M14.5 11h6',
  konto: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0',
  stammdaten: 'M5 21V4h10v17M15 9h4.5v12M3 21h18M8 8h4M8 12h4M8 16h4',
  vorlagen: 'M8.5 8.5H20V20H8.5zM4 15.5V4h11.5',
  protokoll: 'M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  hilfe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8M12 16.8h.01',
  versionen: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.8 5.8l2.7 2.7M15.5 15.5l2.7 2.7M18.2 5.8l-2.7 2.7M8.5 15.5l-2.7 2.7',
  sonne: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  mond: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  abmelden: 'M14.5 4H19v16h-4.5M10 8l-4 4 4 4M6 12h9.5',
  fuehrung: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  oben: 'M6 14.5l6-6 6 6',
  laden: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14',
  unten: 'M6 9.5l6 6 6-6',
  zu: 'M6 6l12 12M18 6 6 18',
  lernen: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5zM7 8h1.5M7 11h1.5M15.5 8H17M15.5 11H17',
  kaefer: 'M9 8a3 3 0 0 1 6 0M7.5 10.5h9V15a4.5 4.5 0 0 1-9 0zM12 10.5v9M3.5 13.5h4M16.5 13.5h4M5 19.5l3-2.2M19 19.5l-3-2.2M5 7.5l3 3M19 7.5l-3 3',
  baustein: 'M4 9.5h7V4h9v7h-5.5v9H4zM11 9.5V15h3.5',
  sammel: 'M4 5h5v5H4zM4 14h5v5H4zM12.5 6h8M12.5 9.5h5M12.5 15h8M12.5 18.5h5',
  bild: 'M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 3-3 4.5 4.5M15 9.5h.01',
  pdf: 'M12 3.5v10M7.5 9.5 12 14l4.5-4.5M5 17v3h14v-3',
  stern: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.3 2.8 1-5.9-4.3-4.1 5.9-.8z',
  haken: 'M5 12.5l4.5 4.5L19 7.5',
  urlaub: 'M4 8.5h16V19H4zM9 8.5V5.5h6v3M4 13h16M12 12v2',
  glocke: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0',
  // Rückmeldung geben: ein frohes und ein trauriges Gesicht – selbst gezeichnet (für 24 px gedacht)
  ruf: 'M6.6 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2zM4.9 12.9a2 2 0 0 0 3.4 0M5.2 10.7h.01M8 10.7h.01M17.4 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2zM15.7 14a2 2 0 0 1 3.4 0M16 10.7h.01M18.8 10.7h.01',
} as const;

export type IconName = keyof typeof PFADE;

export function Icon({ name, groesse = 20 }: { name: IconName; groesse?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={groesse} height={groesse} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PFADE[name]} />
    </svg>
  );
}
