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
  /** Hinweise auf neue Versionen zeigen (1) oder nicht (0) */
  versionshinweis: number;
  erstellt: string;
  erstellt_von: number | null;
  letzte_anmeldung: string | null;
  /** nur Ausbilder: Gesamtsicht über alle Azubis (setzt der Super-Admin) */
  alle_azubis: number;
  /** Profilbild aus Entra anzeigen (1) oder nicht (0) */
  bild_zeigen: number;
  /** Kennung des gespeicherten Profilbilds; null = keins */
  bild_stand: string | null;
}

/** Adresse des Profilbilds eines Kontos – oder null, wenn es keins gibt oder die Person es abgeschaltet hat. */
export function bildPfad(z: Pick<BenutzerZeile, 'id' | 'bild_zeigen' | 'bild_stand'>): string | null {
  return z.bild_zeigen === 1 && z.bild_stand ? `/api/benutzer/${z.id}/bild?v=${z.bild_stand}` : null;
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
  /** Adresse des Profilbilds oder null */
  bild: string | null;
  /** will die Person ihr Profilbild zeigen? */
  bildZeigen: boolean;
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
    bild: bildPfad(z),
    bildZeigen: z.bild_zeigen === 1,
  };
}

export interface Zuweisung {
  id: number;
  azubi_id: number;
  beauftragter_id: number;
  von: string | null;
  bis: string | null;
}
