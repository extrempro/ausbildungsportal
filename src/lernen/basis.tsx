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
}
const AZUBI: LernBasis = { basis: '/lernen', api: '/api/lernen', lesen: false };
const Kontext = createContext<LernBasis>(AZUBI);
export const useLern = (): LernBasis => useContext(Kontext);

/** Stellt die Lernseiten darunter auf die Leseansicht eines Pakets um. */
export function Leseansicht({ paket, children }: { paket: string; children: ReactNode }) {
  return <Kontext.Provider value={{ basis: `/lerninhalte/${paket}`, api: `/api/lerninhalte/${paket}`, lesen: true }}>{children}</Kontext.Provider>;
}
