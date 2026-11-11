import type { Kontext } from './api-basis';
import { MailFehler } from './smtp';
import { leseBetrieb } from './stammdaten';

/**
 * Mail an die Personalstelle, wenn ein Urlaub genehmigt oder ein genehmigter Urlaub storniert wurde.
 * - Reine Information: Die Personalstelle hat kein Konto im Portal und bestätigt nichts.
 * - Inhalt so knapp wie möglich: Name, Zeitraum, Arbeitstage, wer bestätigt und entschieden hat.
 *   Die Bemerkung des Azubis und die Begründung einer Stornierung gehen nicht mit.
 * - Die Entscheidung gilt auch, wenn die Mail nicht ankommt. Der Stand steht am Antrag
 *   (gesendet / fehler / ohne) und der Ausbilder kann erneut senden.
 */
const d = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

interface Zeile {
  id: number;
  azubi: string;
  von: string;
  bis: string;
  tage: number;
  status: string;
  erstellt: string;
}

export function urlaubMail(k: Kontext, antragId: number): { betreff: string; text: string } | null {
  const z = k.db.prepare('SELECT a.id, b.anzeigename AS azubi, a.von, a.bis, a.tage, a.status, a.erstellt FROM urlaub_antrag a JOIN benutzer b ON b.id = a.azubi_id WHERE a.id = ?').get(antragId) as Zeile | undefined;
  if (!z || (z.status !== 'genehmigt' && z.status !== 'storniert')) return null;
  const verlauf = k.db.prepare('SELECT aktion, name, zeit FROM urlaub_verlauf WHERE antrag_id = ? ORDER BY id').all(antragId) as unknown as { aktion: string; name: string; zeit: string }[];
  const letzte = (aktion: string) => verlauf.filter((v) => v.aktion === aktion).at(-1);
  const bestaetigt = verlauf.filter((v) => v.aktion === 'bestaetigt').map((v) => v.name);
  const genehmigt = letzte('genehmigt');
  const storniert = letzte('storniert');
  const zeitraum = z.von === z.bis ? d(z.von) : `${d(z.von)} bis ${d(z.bis)}`;
  const betrieb = leseBetrieb(k.db).name;
  const storno = z.status === 'storniert';
  const zeilen = [
    'Guten Tag,',
    '',
    storno ? `der genehmigte Urlaub von ${z.azubi} wurde storniert. Der Urlaub findet nicht statt.` : `für ${z.azubi} (Auszubildende/r) wurde Urlaub genehmigt.`,
    '',
    `Zeitraum: ${zeitraum}`,
    `Arbeitstage: ${z.tage} (Montag bis Freitag ohne Feiertage)`,
    `Beantragt am: ${d(z.erstellt.slice(0, 10))}`,
    ...(bestaetigt.length ? [`Bestätigt von: ${bestaetigt.join(', ')}`] : []),
    ...(genehmigt ? [`Genehmigt von: ${genehmigt.name} am ${d(genehmigt.zeit.slice(0, 10))}`] : []),
    ...(storno && storniert ? [`Storniert von: ${storniert.name} am ${d(storniert.zeit.slice(0, 10))}`] : []),
    '',
    `Diese Mail hat das Ausbildungsportal${betrieb ? ` (${betrieb})` : ''} automatisch verschickt. Bitte nicht auf diese Mail antworten – Rückfragen an die genannte Ausbilderin oder den genannten Ausbilder.`,
  ];
  return { betreff: `${storno ? 'Urlaub storniert' : 'Urlaub genehmigt'}: ${z.azubi}, ${zeitraum.replace(' bis ', '–')}`, text: zeilen.join('\n') };
}

/** Warum gerade nichts gesendet werden kann – oder null, wenn alles eingerichtet ist. */
export function mailHindernis(k: Kontext): string | null {
  if (!k.cfg.smtp) return 'Der Mailversand ist im Portal nicht eingerichtet – das macht der Betreiber des Portals.';
  if (!leseBetrieb(k.db).personalMail) return 'In den Stammdaten fehlt die Mail-Adresse der Personalstelle.';
  return null;
}

/** Sendet eine Mail und gibt bei einem Fehler den anzeigbaren Grund zurück. Im Log steht nie mehr als dieser Grund. */
export async function versende(k: Kontext, an: string, betreff: string, text: string): Promise<string | null> {
  try {
    await k.mail({ an, betreff, text });
    return null;
  } catch (e) {
    const grund = e instanceof MailFehler ? e.message : 'Die Mail konnte nicht gesendet werden';
    k.log(`Mailversand fehlgeschlagen: ${grund}`);
    return grund;
  }
}

/** Informiert die Personalstelle über den Antrag und hält den Stand am Antrag fest. */
export async function informierePersonal(k: Kontext, antragId: number): Promise<void> {
  const setze = (stand: string, fehler: string) => k.db.prepare('UPDATE urlaub_antrag SET mail_stand = ?, mail_fehler = ? WHERE id = ?').run(stand, fehler.slice(0, 300), antragId);
  const mail = urlaubMail(k, antragId);
  if (!mail) return;
  const hindernis = mailHindernis(k);
  if (hindernis) {
    setze('ohne', hindernis);
    return;
  }
  const fehler = await versende(k, leseBetrieb(k.db).personalMail, mail.betreff, mail.text);
  setze(fehler ? 'fehler' : 'gesendet', fehler ?? '');
}
