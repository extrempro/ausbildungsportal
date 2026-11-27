-- Game Vault: das Pflanzenregal der Azubis (freiwillig, privat für den Azubi).
-- Es gibt keine Route für Ausbilder, Beauftragte oder Super-Admin. Das Guthaben an Tropfen und Funken wird nicht
-- gespeichert, sondern bei jedem Aufruf aus Berichtsheft und Lernstand errechnet; hier stehen nur die Ausgaben,
-- ein Zähler für wiederholte Karteikarten (ohne Datum) und die Höchststände, damit ein zurückgestellter Lernstand
-- keine Tropfen wegnimmt.
CREATE TABLE regal (
  azubi_id     INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  an           INTEGER NOT NULL DEFAULT 1,
  tropfen_aus  INTEGER NOT NULL DEFAULT 0,   -- ausgegebene Tropfen
  funken_aus   INTEGER NOT NULL DEFAULT 0,   -- ausgegebene Funken
  karten       INTEGER NOT NULL DEFAULT 0,   -- fällige Karteikarten wiederholt (nur die Zahl)
  lern_max     INTEGER NOT NULL DEFAULT 0,   -- höchste Tropfen aus der Ampel im Lernstand bisher
  funken_max   INTEGER NOT NULL DEFAULT 0,   -- höchste Funken aus Zusatzwissen bisher
  pakete       INTEGER NOT NULL DEFAULT 0,   -- eingelöste Samenpakete aus Meilensteinen
  gadgets      TEXT NOT NULL DEFAULT '',     -- gekaufte Gadgets, durch Komma getrennt
  vorrat       TEXT NOT NULL DEFAULT '{}'    -- JSON: Booster im Vorrat, z. B. {"lampe":1}
);

CREATE TABLE regal_pflanze (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  azubi_id    INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  platz       INTEGER NOT NULL,
  art         TEXT NOT NULL,
  stufe       INTEGER NOT NULL DEFAULT 1 CHECK (stufe BETWEEN 1 AND 4),
  wuchs       INTEGER NOT NULL DEFAULT 0,
  gegossen    TEXT NOT NULL,                -- Tag (ohne Uhrzeit) – daraus ergibt sich, wie feucht die Erde ist
  booster     TEXT NOT NULL DEFAULT '',
  booster_bis TEXT,
  UNIQUE (azubi_id, platz)
);
