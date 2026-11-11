-- Lernmodul „Üben“: Karteikarten (Lernkartei mit fünf Fächern) und Quiz je Unterthema.
-- Privat wie der übrige Lernstand – nur der Azubi selbst liest und schreibt (server/lernen.ts).
CREATE TABLE lern_karte (
  azubi_id INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket    TEXT NOT NULL,
  karte_id TEXT NOT NULL,                  -- 'b:themenfeld.unterthema:<kennung des begriffs>' oder 'f:themenfeld.unterthema'
  fach     INTEGER NOT NULL CHECK (fach BETWEEN 1 AND 5),
  faellig  TEXT NOT NULL,                  -- Tag, ab dem die Karte wieder dran ist
  zuletzt  TEXT NOT NULL,
  PRIMARY KEY (azubi_id, paket, karte_id)
);

CREATE TABLE lern_quiz (
  azubi_id       INTEGER NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
  paket          TEXT NOT NULL,
  unterthema_id  TEXT NOT NULL,            -- 'themenfeld.unterthema'
  versuche       INTEGER NOT NULL DEFAULT 0,
  letzte_richtig INTEGER NOT NULL DEFAULT 0,
  letzte_gesamt  INTEGER NOT NULL DEFAULT 0,
  zuletzt        TEXT NOT NULL,
  bestanden_am   TEXT,                     -- erstes Mal mit mindestens 80 %
  meister_am     TEXT,                     -- fehlerfrei, frühestens sieben Tage nach dem Bestehen
  PRIMARY KEY (azubi_id, paket, unterthema_id)
);
