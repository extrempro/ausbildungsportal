export type Rolle = 'admin' | 'ausbilder' | 'beauftragter' | 'azubi';
export const ROLLEN: Rolle[] = ['admin', 'ausbilder', 'beauftragter', 'azubi'];
export type Theme = 'auto' | 'light' | 'dark';

/** Zeile der Tabelle benutzer – verlässt das Backend nie in dieser Form. */
export interface BenutzerZeile {
  id: number;
  anmeldung: 'entra' | 'lokal';
  anmeldename: string;
  entra_oid: string | null;
  anzeigename: string;
  rolle: Rolle;
  passwort_hash: string | null;
  passwort_wechsel: number;
  status: 'aktiv' | 'gesperrt';
  fehlversuche: number;
  gesperrt_bis: string | null;
  theme: Theme;
  erstellt: string;
  erstellt_von: number | null;
  letzte_anmeldung: string | null;
  /** nur Ausbilder: Gesamtsicht über alle Azubis (setzt der Super-Admin) */
  alle_azubis: number;
}

/** Was die API über ein Konto herausgibt (ohne Hash, ohne Objekt-ID). */
export interface Konto {
  id: number;
  anmeldung: 'entra' | 'lokal';
  anmeldename: string;
  anzeigename: string;
  rolle: Rolle;
  status: 'aktiv' | 'gesperrt';
  /** Entra-Konto wurde schon einmal angemeldet und ist fest mit der Objekt-ID verknüpft */
  verknuepft: boolean;
  passwortWechsel: boolean;
  theme: Theme;
  erstellt: string;
  letzteAnmeldung: string | null;
  /** Ausbilder mit Gesamtsicht: sieht und bearbeitet alle Azubis, nicht nur die eigenen */
  alleAzubis: boolean;
}

export function alsKonto(z: BenutzerZeile): Konto {
  return {
    id: z.id,
    anmeldung: z.anmeldung,
    anmeldename: z.anmeldename,
    anzeigename: z.anzeigename,
    rolle: z.rolle,
    status: z.status,
    verknuepft: z.anmeldung === 'lokal' || z.entra_oid !== null,
    passwortWechsel: z.passwort_wechsel === 1,
    theme: z.theme,
    erstellt: z.erstellt,
    letzteAnmeldung: z.letzte_anmeldung,
    alleAzubis: z.rolle === 'ausbilder' && z.alle_azubis === 1,
  };
}

export interface Zuweisung {
  id: number;
  azubi_id: number;
  beauftragter_id: number;
  von: string | null;
  bis: string | null;
}
