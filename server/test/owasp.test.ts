import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUTEN } from '../api';
import { admin, koerper, konto, ohneWechsel, ruf, sitzung, umgebung, zuweisen } from './hilfe';

/**
 * Fehlerhafte Zugriffskontrolle (OWASP A01:2025): Jede Route mit Kennung im Pfad wird von Fremden aufgerufen –
 * einem anderen Azubi, einer nicht zugewiesenen Beauftragten, einem nicht zuständigen Ausbilder.
 * Sie zielen auf echte Daten von Azubi A (Plan-Eintrag, Urlaubsantrag, Bericht, Anhang, Konto) – einmal direkt,
 * einmal mit der Unter-Kennung von A unter dem eigenen Azubi. Keine Anfrage darf gelingen oder den Server stören.
 */
test('Fremde erreichen über keine Route mit Kennung die Daten eines anderen Azubis', async () => {
  const u = await umgebung();
  ohneWechsel(u.db, admin(u.db).id);
  const a = konto(u.db, 'azubi', 'Azubi A');
  const b = konto(u.db, 'azubi', 'Azubi B');
  const aus1 = konto(u.db, 'ausbilder');
  const aus2 = konto(u.db, 'ausbilder');
  const bea1 = konto(u.db, 'beauftragter');
  const bea2 = konto(u.db, 'beauftragter');
  const c1 = sitzung(u, aus1);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: c1, body: { name: 'Muster GmbH', bundesland: 'HH', berichtForm: 'woche' } });
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c1, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: aus1.id } })).status, 200);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${b.id}/profil`, { cookies: c1, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: aus2.id } })).status, 200);
  zuweisen(u.db, a, bea1);
  zuweisen(u.db, b, bea2);

  // echte Daten von Azubi A
  const eintrag = await ruf(u, 'POST', `/api/azubis/${a.id}/plan`, { cookies: c1, body: { art: 'einsatz', titel: 'Lager', von: '2026-12-07' } });
  assert.equal(eintrag.status, 201);
  const antrag = await ruf(u, 'POST', `/api/azubis/${a.id}/urlaub`, { cookies: sitzung(u, a), body: { von: '2026-12-21', bis: '2026-12-22' } });
  assert.equal(antrag.status, 201);
  assert.equal((await ruf(u, 'PUT', `/api/azubis/${a.id}/berichte/2026-11-02`, { cookies: sitzung(u, a), body: { inhalt: { betrieb: [{ text: 'Nur für A', stunden: 38 }] } } })).status, 200);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
  const anhang = await ruf(u, 'POST', `/api/azubis/${a.id}/berichte/2026-11-02/anhaenge?name=foto.jpg`, { cookies: sitzung(u, a), body: jpg });
  assert.ok(anhang.status < 300, `Anhang: ${anhang.status}`);
  const ids = {
    eid: String(koerper(eintrag).eintrag?.id ?? koerper(eintrag).id),
    urlaub: String(koerper(antrag).antrag?.id ?? koerper(antrag).id),
    anhang: String(koerper(anhang).anhaenge?.[0]?.id),
  };
  for (const [name, id] of Object.entries(ids)) assert.match(id, /^\d+$/, name);

  const fremde = { azubi: b, ausbilder: aus2, beauftragter: bea2 } as const;
  let geprueft = 0;
  for (const r of ROUTEN) {
    if (r.wer === 'offen' || !r.p.includes(':')) continue;
    for (const [rolle, wer] of Object.entries(fremde)) {
      if (r.wer !== 'alle' && !r.wer.includes(rolle as never)) continue;
      const azubiRoute = r.p.startsWith('/api/azubis/:id');
      const unterKennung = /:(eid|anhang)\b/.test(r.p);
      // direkt auf A – und bei Unter-Kennungen: A's Eintrag/Anhang unter dem eigenen Azubi B
      for (const azubiId of azubiRoute && unterKennung ? [a.id, b.id] : [a.id]) {
        const id = r.p.startsWith('/api/urlaub/') ? ids.urlaub : String(azubiId);
        const pfad = r.p.replace(':id', id).replace(':montag', '2026-11-02').replace(':eid', ids.eid).replace(':anhang', ids.anhang).replace(/:[a-z]+/g, '1');
        // Profilbilder sieht jeder Angemeldete (Avatar) – das ist gewollt
        if (r.p === '/api/benutzer/:id/bild') continue;
        // Konten: nur die von Azubi A
        if (!azubiRoute && !r.p.startsWith('/api/urlaub/') && !r.p.startsWith('/api/konten/')) continue;
        const x = await ruf(u, r.m, pfad, { cookies: sitzung(u, wer), body: {} });
        assert.ok(x.status >= 400 && x.status < 500 && x.status !== 401, `${r.m} ${pfad} als fremde/r ${rolle}: ${x.status} ${JSON.stringify(x.body).slice(0, 120)}`);
        geprueft++;
      }
    }
  }
  assert.ok(geprueft >= 70, `nur ${geprueft} Aufrufe geprüft`);

  // A's Daten sind unverändert da
  const plan = koerper(await ruf(u, 'GET', `/api/azubis/${a.id}/plan`, { cookies: c1 }));
  assert.ok(JSON.stringify(plan).includes('Lager'));
  const bericht = koerper(await ruf(u, 'GET', `/api/azubis/${a.id}/berichte/2026-11-02`, { cookies: sitzung(u, a) }));
  assert.ok(JSON.stringify(bericht).includes('Nur für A'));
});

/**
 * Anfragen von fremden Seiten (CSRF): Schreibende Anfragen prüfen die Herkunft (Origin). Ein Link oder Bild auf einer
 * fremden Seite löst aber ein GET aus – deshalb darf kein GET etwas in der Datenbank ändern.
 */
test('kein GET ändert etwas in der Datenbank – für jede Rolle', async () => {
  const u = await umgebung({ DEV_ANMELDUNG: 'true' });
  ohneWechsel(u.db, admin(u.db).id);
  const a = konto(u.db, 'azubi');
  const aus = konto(u.db, 'ausbilder');
  const bea = konto(u.db, 'beauftragter');
  const c1 = sitzung(u, aus);
  await ruf(u, 'PUT', '/api/stammdaten/betrieb', { cookies: c1, body: { name: 'Muster GmbH', bundesland: 'HH', berichtForm: 'woche' } });
  await ruf(u, 'PUT', `/api/azubis/${a.id}/profil`, { cookies: c1, body: { ausbildungsbeginn: '2025-08-01', ausbilderId: aus.id } });
  zuweisen(u.db, a, bea);
  const wer = { azubi: a, ausbilder: aus, beauftragter: bea, admin: admin(u.db) } as const;
  const cookies = Object.fromEntries(Object.entries(wer).map(([r, b]) => [r, sitzung(u, b)]));
  const aenderungen = () => (u.db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
  let geprueft = 0;
  for (const r of ROUTEN) {
    if (r.m !== 'GET') continue;
    for (const rolle of Object.keys(wer)) {
      if (r.wer !== 'offen' && r.wer !== 'alle' && !r.wer.includes(rolle as never)) continue;
      const pfad = r.p.replace(':id', String(a.id)).replace(':montag', '2026-11-02').replace(/:[a-z]+/g, '1');
      const vorher = aenderungen();
      await ruf(u, 'GET', pfad, { cookies: cookies[rolle] });
      assert.equal(aenderungen(), vorher, `GET ${r.p} als ${rolle} ändert die Datenbank`);
      geprueft++;
    }
  }
  assert.ok(geprueft >= 60, `nur ${geprueft} Aufrufe geprüft`);
});
