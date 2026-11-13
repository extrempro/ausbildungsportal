-- Hinweise auf neue Versionen („Das Portal wurde aktualisiert“) ein- oder ausschalten – Konto → Darstellung, jede Rolle.
ALTER TABLE benutzer ADD COLUMN versionshinweis INTEGER NOT NULL DEFAULT 1 CHECK (versionshinweis IN (0, 1));
