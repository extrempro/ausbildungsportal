-- Ausbilder sehen und bearbeiten nur noch die Azubis, für die sie zuständig sind (azubi_profil.ausbilder_id),
-- Azubis ohne zuständigen Ausbilder und – als Vertretung – Azubis, die ihnen für einen Zeitraum zugewiesen sind.
-- alle_azubis = 1 gibt einem Ausbilder-Konto die Gesamtsicht (Ausbildungsleitung); das setzt nur der Super-Admin.
ALTER TABLE benutzer ADD COLUMN alle_azubis INTEGER NOT NULL DEFAULT 0;
