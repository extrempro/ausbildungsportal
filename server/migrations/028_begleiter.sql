-- Begleiter: eine kleine Figur, die Azubis durch das Portal begleitet (reines Beiwerk, freiwillig).
-- Je Azubi: gewählte Figur, ihr Name, an/aus, ob die Frage „Willst du einen Begleiter?“ schon beantwortet ist und
-- bis zu welchem Zubehör-Teil die Animation „neues Teil“ schon gezeigt wurde. Privat für den Azubi – es gibt keine
-- Route für Ausbilder, Beauftragte oder Super-Admin. Welche Teile der Begleiter hat, wird nicht gespeichert:
-- Es ergibt sich aus der Ausbildungszeit (Beginn und Ende im Profil).
CREATE TABLE begleiter (
  azubi_id      INTEGER PRIMARY KEY REFERENCES benutzer(id) ON DELETE CASCADE,
  figur         TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  an            INTEGER NOT NULL DEFAULT 0,
  gefragt       INTEGER NOT NULL DEFAULT 0,
  stufe_gezeigt INTEGER NOT NULL DEFAULT 0,
  geaendert     TEXT NOT NULL
);
