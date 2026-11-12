import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Woher die Lernseiten ihre Inhalte holen und wohin ihre Links führen.
 * - Azubi: /lernen und /api/lernen – mit eigenem Lernstand (Ampel, Notizen, Abzeichen).
 * - Ausbilder und Beauftragte: /lerninhalte/<paket> und /api/lerninhalte/<paket> – dieselben Inhalte nur zum Lesen.
 */
export interface LernBasis {
  /** Anfang der Seitenadressen, z. B. '/lernen' */
  basis: string;
  /** Anfang der API-Adressen, z. B. '/api/lernen' */
  api: string;
  /** Leseansicht: keine Ampel, keine Notizen, keine Abzeichen */
  lesen: boolean;
  /** Azubi: welche Bereiche es unter „Lernen“ für ihn gibt – das eigene Lernmodul und/oder das Paket für alle Berufe (sein Titel) */
  azubi?: { lernen: boolean; allgemein: string | null };
  /** die Seite zeigt das Paket für alle Berufe (Anleitungen): nur zum Lesen, für den Azubi selbst */
  anleitungen?: boolean;
}
const AZUBI: LernBasis = { basis: '/lernen', api: '/api/lernen', lesen: false };
const Kontext = createContext<LernBasis>(AZUBI);
export const useLern = (): LernBasis => useContext(Kontext);

/** Für Azubis: sagt den Lernseiten, welche Reiter es gibt. */
export function LernAzubi({ lernen, allgemein, children }: { lernen: boolean; allgemein: string | null; children: ReactNode }) {
  return <Kontext.Provider value={{ ...AZUBI, azubi: { lernen, allgemein } }}>{children}</Kontext.Provider>;
}

/** Stellt die Lernseiten darunter auf das Paket für alle Berufe um – der Azubi liest es, ohne Ampel und Abzeichen. */
export function Anleitungen({ children }: { children: ReactNode }) {
  const aussen = useContext(Kontext);
  return <Kontext.Provider value={{ basis: '/anleitungen', api: '/api/anleitungen', lesen: true, azubi: aussen.azubi, anleitungen: true }}>{children}</Kontext.Provider>;
}

/** Stellt die Lernseiten darunter auf die Leseansicht eines Pakets um. */
export function Leseansicht({ paket, children }: { paket: string; children: ReactNode }) {
  return <Kontext.Provider value={{ basis: `/lerninhalte/${paket}`, api: `/api/lerninhalte/${paket}`, lesen: true }}>{children}</Kontext.Provider>;
}
