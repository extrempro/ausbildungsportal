-- „Angemeldete Geräte“ unter Konto: je Sitzung ein kurzer Text zum Gerät, nur Browser und System (z. B. „Safari · iPhone“),
-- grob aus der Browserkennung gelesen. Keine IP-Adresse, keine Gerätekennung. Verschwindet mit der Sitzung (höchstens 24 Stunden).
ALTER TABLE sitzung ADD COLUMN geraet TEXT NOT NULL DEFAULT '';
