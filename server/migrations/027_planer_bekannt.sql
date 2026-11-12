-- Planer: welche Punkte (Kennungen) der Azubi schon gesehen hat. Kommt durch eine neue Fassung des Inhaltspakets ein
-- Termin, ein Checklisten-Punkt oder eine Frage dazu, weist der Planer darauf hin, bis der Azubi es bestätigt.
-- NULL = noch nicht festgehalten (wird beim nächsten Speichern mit dem aktuellen Stand gefüllt).
ALTER TABLE planer ADD COLUMN bekannt TEXT;
