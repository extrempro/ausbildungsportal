import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Die Versionsnummer steht an drei Stellen und als oberster Abschnitt in den Versionshinweisen.
// Läuft das auseinander, zeigt das Portal eine andere Version als die Dokumentation – oder die Versionshinweise fehlen.

const wurzel = join(import.meta.dirname, '..', '..');
const lies = (datei: string) => readFileSync(join(wurzel, datei), 'utf8');
const VERSION = /^\d+\.\d+\.\d+$/;

test('die Versionsnummer ist überall gleich und steht in den Versionshinweisen', () => {
  const version = (JSON.parse(lies('package.json')) as { version: string }).version;
  assert.match(version, VERSION, 'package.json: "version" hat die Form 1.2.3');

  const readme = /\*\*Stand: Version (\d+\.\d+\.\d+)\.\*\*/.exec(lies('README.md'));
  assert.ok(readme, 'README.md: die Zeile „**Stand: Version x.y.z.**“ fehlt');
  assert.equal(readme[1], version, `README.md nennt Version ${readme[1]}, package.json ${version} – bitte angleichen`);

  const entra = /passt zu Version (\d+\.\d+\.\d+)/.exec(lies('docs/entra-einrichtung.md'));
  assert.ok(entra, 'docs/entra-einrichtung.md: „passt zu Version x.y.z“ fehlt');
  assert.equal(entra[1], version, `docs/entra-einrichtung.md nennt Version ${entra[1]}, package.json ${version} – bitte angleichen`);

  const abschnitte = [...lies('CHANGELOG.md').matchAll(/^## \[(\d+\.\d+\.\d+)\] – (\d{4}-\d{2}-\d{2})$/gm)];
  assert.ok(abschnitte.length > 0, 'CHANGELOG.md: kein Abschnitt der Form „## [x.y.z] – JJJJ-MM-TT“');
  assert.equal(abschnitte[0][1], version, `CHANGELOG.md: der oberste Abschnitt ist ${abschnitte[0][1]}, package.json nennt ${version} – der Eintrag für die neue Version fehlt`);
});

test('die Versionshinweise sind absteigend geordnet und nennen keine Version doppelt', () => {
  const zahl = (v: string) => v.split('.').map(Number).reduce((n, x) => n * 1000 + x, 0);
  const versionen = [...lies('CHANGELOG.md').matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
  for (let i = 1; i < versionen.length; i++) assert.ok(zahl(versionen[i - 1]) > zahl(versionen[i]), `CHANGELOG.md: ${versionen[i - 1]} steht vor ${versionen[i]} – neuere Versionen gehören nach oben, jede nur einmal`);
});
