-- Erinnerungen des Begleiters: Welche Arten der Azubi abgeschaltet hat (Kennungen, durch Komma getrennt; leer = alle an).
-- Ob und wann eine Erinnerung gezeigt wurde, wird nicht auf dem Server gespeichert – das merkt sich nur der Browser des Azubis.
ALTER TABLE begleiter ADD COLUMN erinnern_aus TEXT NOT NULL DEFAULT '';
