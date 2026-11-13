import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ADMIN, ANNA, BEA, BEN, HANDY, mitFoto, PC, PETRA, startePortal, text, ueberlauf } from './hilfe';
import type { Portal } from './hilfe';

let p: Portal;
before(async () => {
  p = await startePortal();
  await p.grunddaten();
});
after(() => p.stop());

/**
 * Klickt die Führung von der ersten bis zur letzten Station durch und prüft bei jeder:
 * Sie findet ihr Ziel, die Karte liegt vollständig im Bild, „Weiter“ ist erreichbar, nichts läuft waagerecht über.
 */
async function durchlauf(wer: string, groesse: { breite: number; hoehe: number }): Promise<string[]> {
  const s = await p.seite(wer, { ...groesse, mitAngeboten: true });
  await s.click('.fuehrung-angebot button:has-text("Führung starten")');
  const titel: string[] = [];
  const maengel: string[] = [];
  for (let i = 0; i < 40; i++) {
    await s.waitForSelector('.fuehrung-karte');
    await s.waitForTimeout(250);
    const t = await text(s, '#fuehrung-titel');
    titel.push(t);
    const k = (await s.locator('.fuehrung-karte').boundingBox())!;
    if (k.x < 0 || k.y < 0 || k.x + k.width > groesse.breite + 1 || k.y + k.height > groesse.hoehe + 1) maengel.push(`„${t}“: Die Karte ragt aus dem Bild`);
    // die erste Station begrüßt nur – alle anderen zeigen auf etwas
    if (i > 0 && (await s.locator('.fuehrung-ring').count()) === 0) maengel.push(`„${t}“: kein Ziel gefunden`);
    if ((await ueberlauf(s)) > 0) maengel.push(`„${t}“: waagerechter Überlauf`);
    const weiter = s.locator('.fuehrung-weiter');
    const letzter = !/Weiter/.test((await weiter.innerText()).trim());
    await weiter.click({ timeout: 3000 }).catch(async () => {
      maengel.push(`„${t}“: Der Knopf ist nicht erreichbar`);
      await weiter.evaluate((b: HTMLElement) => b.click());
    });
    if (letzter) break;
  }
  await s.waitForSelector('.fuehrung-karte', { state: 'detached' });
  assert.deepEqual(maengel, [], `${wer} bei ${groesse.breite} px`);
  // einmal gesehen: beim nächsten Laden kommt das Angebot nicht wieder
  await s.reload();
  await s.waitForSelector('main h1');
  await s.waitForLoadState('networkidle');
  assert.equal(await s.locator('.fuehrung-angebot').count(), 0, 'das Angebot kommt nicht noch einmal');
  await s.context().close();
  return titel;
}

test(
  'Führung für Azubis: jede Station findet ihr Ziel – am PC und am Handy; Bereiche, die es nicht gibt, fallen weg',
  mitFoto(() => p, 'fuehrung-azubi', async () => {
    const anna = await durchlauf(ANNA, PC);
    for (const station of ['Dein Ausbildungsplan', 'Das Berichtsheft', 'Deine Unterschrift', 'Urlaub beantragen', 'Lernen', 'Planer für deine Prüfung', 'Nachrichten per Teams oder E-Mail']) assert.ok(anna.includes(station), `Station „${station}“ fehlt: ${anna.join(' › ')}`);
    // Ben hat weder Lernmodul noch Planer – und noch keinen Ausbildungsbeginn: Was es für ihn nicht gibt, zeigt die Führung nicht
    const ben = await durchlauf(BEN, HANDY);
    for (const station of ['Lernen', 'Planer für deine Prüfung', 'Anleitungen', 'Auf einen Blick', 'Alle Wochen']) assert.ok(!ben.includes(station), `„${station}“ gibt es für Ben nicht: ${ben.join(' › ')}`);
    assert.ok(ben.includes('Urlaub beantragen'));
  }),
);

test(
  'Führung für Ausbilderin, Beauftragte und Super-Admin',
  mitFoto(() => p, 'fuehrung-betreuung', async () => {
    const petra = await durchlauf(PETRA, PC);
    for (const station of ['Berichte abzeichnen', 'Urlaubsanträge', 'Wer ist wann wo?', 'Lerninhalte', 'Planung', 'Verwaltung']) assert.ok(petra.includes(station), `Station „${station}“ fehlt: ${petra.join(' › ')}`);
    const bea = await durchlauf(BEA, HANDY);
    assert.ok(bea.includes('Berichte abzeichnen') && !bea.includes('Verwaltung'), bea.join(' › '));
    const chef = await durchlauf(ADMIN.name, PC);
    for (const station of ['Konten', 'Protokoll', 'Fehlermeldungen', 'Lerninhalte', 'Erscheinungsbild']) assert.ok(chef.includes(station), `Station „${station}“ fehlt: ${chef.join(' › ')}`);
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);

test(
  'Begleiter: erst die Führung, dann das Angebot; Figur wählen, neues Teil, Erinnerung – und für andere unsichtbar',
  mitFoto(() => p, 'begleiter', async () => {
    const s = await p.seite(ANNA, { mitAngeboten: true });
    // erst wird die Führung angeboten; solange wartet der Begleiter
    await s.waitForSelector('.fuehrung-angebot');
    assert.equal(await s.locator('.begleiter-angebot').count(), 0);
    await s.click('.fuehrung-angebot button:has-text("Später")');
    await s.waitForSelector('.begleiter-angebot');
    await s.click('.begleiter-angebot button:has-text("Begleiter aussuchen")');
    assert.equal(await s.locator('.begleiter-wahl label').count(), 5);
    await s.click('.begleiter-wahl label:has-text("Biber")');
    await s.fill('.begleiter-fenster input[maxlength="20"]', 'Bruno');
    await s.click('button:has-text("Begleiter einschalten")');
    // seit gut einem Jahr dabei: die bis heute fälligen Teile kommen auf einmal
    await s.waitForSelector('.bf-feier');
    assert.match(await text(s, '.bf-feier'), /Bruno/);
    await s.click('.bf-feier button.knopf');
    await s.waitForSelector('.begleiter-ecke .begleiter-figur');
    // er meldet sich: mit einer Erinnerung (es fehlen Berichte) – sie bleibt, bis sie geschlossen wird
    await s.waitForSelector('.begleiter-blase.erinnerung');
    assert.match(await text(s, '.begleiter-blase.erinnerung'), /Bericht|Unterschrift/);
    await s.click('.begleiter-blase.erinnerung button:has-text("Schließen")');
    await s.reload();
    await s.waitForSelector('.begleiter-ecke .begleiter-figur');
    await s.waitForTimeout(800);
    assert.equal(await s.locator('.bf-feier, .begleiter-blase').count(), 0, 'am selben Tag weder zweite Feier noch zweite Erinnerung');
    // am Handy sitzt der Kopf in der Kopfzeile
    await s.setViewportSize({ width: HANDY.breite, height: HANDY.hoehe });
    await s.waitForSelector('.begleiter-kopf');
    assert.equal(await s.locator('.begleiter-ecke').count(), 0);
    assert.equal(await ueberlauf(s), 0);

    // niemand sonst sieht etwas davon; der Super-Admin kann ihn nur für alle aus- und einschalten
    for (const wer of [PETRA, BEA]) assert.equal(await (await p.api().als(wer)).status('GET', '/api/begleiter'), 403, wer);
    const chef = await p.api().alsAdmin();
    assert.equal(await chef.status('GET', '/api/begleiter'), 403);
    await chef.ruf('PUT', '/api/begleiter/einstellung', { an: false });
    await s.reload();
    await s.waitForSelector('main h1');
    await s.waitForLoadState('networkidle');
    assert.equal(await s.locator('.begleiter-kopf, .begleiter-ecke').count(), 0, 'für das Portal ausgeschaltet');
    await chef.ruf('PUT', '/api/begleiter/einstellung', { an: true });
    assert.deepEqual(p.probleme, [], 'keine Fehler in der Konsole');
  }),
);
