import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Passwörter des lokalen Super-Admins: scrypt aus Node.js, kein Zusatzmodul.
 * Format: scrypt$N$r$p$salt$hash (Base64url) – die Parameter stehen im Hash,
 * damit sie später erhöht werden können, ohne alte Hashes zu verlieren.
 */
export const STANDARD = { N: 2 ** 17, r: 8, p: 1 } as const; // OWASP-Empfehlung für scrypt
const LAENGE = 32;
export const MIN_LAENGE = 14;
const MAX_LAENGE = 200;

// kleine Auswahl häufiger Passwörter ab 14 Zeichen bzw. naheliegender Muster
const HAEUFIG = [
  'passwort', 'password', 'kennwort', 'ausbildung', 'administrator', 'willkommen', 'qwertz', 'qwerty',
  '1234567890', 'abcdefgh', 'sommer20', 'winter20', 'hamburg', 'geheim',
];

/**
 * Eine Berechnung braucht mit den Standard-Parametern rund 130 MB Arbeitsspeicher. Damit viele gleichzeitige
 * Anmeldeversuche den Server nicht in die Knie zwingen, laufen die Berechnungen nacheinander.
 */
let warteschlange: Promise<unknown> = Promise.resolve();

function ableiten(passwort: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  const rechne = () =>
    new Promise<Buffer>((ok, fehler) => {
      scrypt(passwort.normalize('NFKC'), salt, LAENGE, { N, r, p, maxmem: 256 * N * r }, (e, key) => (e ? fehler(e) : ok(key)));
    });
  const ergebnis = warteschlange.then(rechne, rechne);
  warteschlange = ergebnis.catch(() => {});
  return ergebnis;
}

export async function hashePasswort(passwort: string, param: { N: number; r: number; p: number } = STANDARD): Promise<string> {
  const salt = randomBytes(16);
  const hash = await ableiten(passwort, salt, param.N, param.r, param.p);
  return ['scrypt', param.N, param.r, param.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function pruefePasswort(gespeichert: string, passwort: string): Promise<boolean> {
  const t = gespeichert.split('$');
  if (t.length !== 6 || t[0] !== 'scrypt') return false;
  const [N, r, p] = [Number(t[1]), Number(t[2]), Number(t[3])];
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || N > 2 ** 20) return false;
  if (typeof passwort !== 'string' || passwort.length > MAX_LAENGE) return false;
  const soll = Buffer.from(t[5], 'base64url');
  const ist = await ableiten(passwort, Buffer.from(t[4], 'base64url'), N, r, p);
  return soll.length === ist.length && timingSafeEqual(soll, ist);
}

/** Liefert eine Fehlermeldung oder null, wenn das Passwort den Regeln genügt. */
export function pruefeRegeln(passwort: unknown, benutzername: string): string | null {
  if (typeof passwort !== 'string') return 'Passwort fehlt';
  if (passwort.length < MIN_LAENGE) return `Das Passwort braucht mindestens ${MIN_LAENGE} Zeichen`;
  if (passwort.length > MAX_LAENGE) return `Das Passwort darf höchstens ${MAX_LAENGE} Zeichen haben`;
  const klein = passwort.toLowerCase();
  if (benutzername && klein.includes(benutzername.toLowerCase())) return 'Das Passwort darf den Benutzernamen nicht enthalten';
  if (new Set(klein).size < 6) return 'Das Passwort besteht aus zu wenigen verschiedenen Zeichen';
  const ohneZiffern = klein.replace(/[0-9!?.\-_#*+]+/g, '');
  if (HAEUFIG.some((h) => ohneZiffern === h || klein === h.repeat(Math.ceil(klein.length / h.length)).slice(0, klein.length))) {
    return 'Dieses Passwort ist zu leicht zu erraten';
  }
  return null;
}

/** Zufälliges Startpasswort, gut abzutippen (ohne leicht verwechselbare Zeichen). */
export function zufallsPasswort(laenge = 20): string {
  const zeichen = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const grenze = 256 - (256 % zeichen.length);
  let s = '';
  while (s.length < laenge) {
    for (const b of randomBytes(laenge)) {
      if (b < grenze && s.length < laenge) s += zeichen[b % zeichen.length];
    }
  }
  return s;
}
