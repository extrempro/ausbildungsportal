export interface Begriff {
  begriff: string;
  erklaerung: string;
}

export interface Tabelle {
  titel: string;
  kopf: string[];
  zeilen: string[][];
}

export interface Befehl {
  befehl: string;
  info: string;
}

export interface Pruefungsfrage {
  frage: string;
  loesung: string[];
}

export interface UnterthemaInhalt {
  id: string;
  titel: string;
  begriffe: Begriff[];
  tabellen: Tabelle[];
  befehle: Befehl[];
  merksatz: string | null;
  frage: Pruefungsfrage | null;
  abbildungen: Abbildung[];
  hatInhalt: boolean;
  /** Hash über den Inhalt (ohne Titel) – für "Inhalt aktualisiert". */
  hash: string;
  /** Kommentar <!-- kein-hinweis --> gesetzt: Änderung soll keinen Hinweis auslösen. */
  keinHinweis: boolean;
}

export interface Link {
  titel: string;
  url: string;
  info: string;
}

/** Eine SVG-Grafik aus content/bilder/. `svg` wird beim Laden gefüllt (bereinigt). */
export interface Bild {
  alt: string;
  datei: string;
  svg: string;
}

export interface Abbildung {
  titel: string;
  bilder: Bild[];
}

export interface VergleichKarte {
  titel: string;
  /** ASCII-Schema aus einem Code-Block (Alternative zu `bild`) */
  schema: string;
  bild: Bild | null;
  kurz: string;
  plus: string;
  minus: string;
  beispiel: string;
}

export interface AblaufGeraet {
  name: string;
  sub: string;
}

export interface AblaufTabelle {
  titel: string;
  kopf: string[];
  zeilen: string[][];
  /** Zeilen (Index), die in diesem Schritt neu sind oder sich geändert haben */
  neu?: number[];
}

export interface AblaufSchritt {
  titel: string;
  text: string;
  aktiv: number[];
  position: number;
  paket: string;
  blockiert?: boolean;
  regel?: number;
  hinweis?: string;
  /** [Bezeichnung, Quelle, Ziel, hervorheben] */
  zeilen: [string, string, string, boolean][];
  /** weitere Kopien des Pakets an diesen Positionen (z. B. Broadcast, der an alle Ports geht) */
  ziele?: number[];
  /** Zustandstabelle, z. B. MAC-, NAT- oder ARP-Tabelle */
  tabelle?: AblaufTabelle;
}

export interface AblaufSzenario {
  id: string;
  label: string;
  merksatz: string;
  geraete: AblaufGeraet[];
  /** [Nr., Quelle, Ziel, Port, Aktion] */
  regeln?: [string, string, string, string, string][];
  /** Spaltenköpfe der Paket-Tabelle (Standard: Feld, Quelle, Ziel) */
  spalten?: [string, string, string];
  /** Überschrift der Paket-Tabelle (Standard: „Was im Paket steht“) */
  zeilenTitel?: string;
  schritte: AblaufSchritt[];
}

/** Abschnitt in einem Zusatz vom Typ "text" (### Überschrift). */
export interface TextAbschnitt {
  /** Darstellung: normaler Text, Checkliste (Punkte mit Haken) oder Vergleichskarten */
  art: 'text' | 'checkliste' | 'vergleich';
  titel: string;
  absaetze: string[];
  bilder: Bild[];
  tabelle: Tabelle | null;
  punkte: string[];
  schritte: string[];
  /** nur bei art "vergleich" */
  karten: VergleichKarte[];
}

export interface Zusatz {
  id: string;
  titel: string;
  typ: 'ablauf' | 'text';
  /** Unterthemen, die dieser Zusatz vertieft – nach dem Laden immer "themenfeld.unterthema" */
  zu: string[];
  intro: string;
  szenarien: AblaufSzenario[];
  absaetze: string[];
  /** nur bei typ "text": Abschnitte mit Text, Grafiken, Tabelle und Listen */
  abschnitte: TextAbschnitt[];
  /** nur intern: Dateiname des Ablaufs */
  ablaufDatei?: string;
}

export interface Themenfeld {
  id: string;
  titel: string;
  icon: string;
  lernfelder: string[];
  pruefung: string[];
  worum: string;
  unterthemen: UnterthemaInhalt[];
  fehler: string[];
  links: Link[];
  zusatz: Zusatz[];
}

export interface KatalogEintrag {
  id: string;
  icon: string;
  lernfelder: string[];
  pruefung: string[];
}

export interface Meldung {
  level: 'fehler' | 'warnung';
  datei: string;
  zeile?: number;
  text: string;
}

export interface Meta {
  stand: string;
}
