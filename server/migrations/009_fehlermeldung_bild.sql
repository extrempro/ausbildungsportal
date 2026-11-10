-- Fehlermeldungen können ein Bildschirmfoto enthalten (freiwillig, vom Browser verkleinert; als Data-URL, höchstens 150 KB).
-- Es wird mit der Meldung gelöscht.
ALTER TABLE fehlermeldung ADD COLUMN bild TEXT;
