import type { Kontext } from './api-basis';
import { logoBild } from './branding';
import type { Mail } from './smtp';
import { leseBetrieb } from './stammdaten';

/**
 * Das gemeinsame Aussehen aller Mails aus dem Portal: Kopf mit Logo und Betrieb, Inhalt, Fußzeile.
 * Jede Mail geht zusätzlich als reiner Text hinaus – den baut, wer die Mail verschickt.
 *
 * Mailprogramme kennen die Farbvariablen des Portals nicht, deshalb stehen hier feste Werte (helle Darstellung).
 * Gestaltet wird mit Tabellen und Angaben direkt am Element – nur das zeigen Mailprogramme verlässlich an.
 */
export type MailFarbe = 'gruen' | 'gelb' | 'rot' | 'blau';
const FARBE: Record<MailFarbe, string> = { gruen: '#166534', gelb: '#b45309', rot: '#b91c1c', blau: '#2563eb' };
const FLAECHE: Record<MailFarbe, string> = { gruen: '#dcfce7', gelb: '#fef3c7', rot: '#fee2e2', blau: '#eff6ff' };

export type MailTeil =
  | { art: 'absatz'; text: string }
  /** hervorgehobene Zeile: worum es geht, auf einen Blick */
  | { art: 'marke'; text: string; farbe: MailFarbe }
  /** Zeilen mit farbigem Punkt davor */
  | { art: 'liste'; zeilen: { text: string; farbe: MailFarbe }[] }
  /** Angaben als „Bezeichnung: Wert“ */
  | { art: 'angaben'; paare: [string, string][] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function teilHtml(t: MailTeil): string {
  if (t.art === 'absatz') return `<p style="margin:0 0 12px;">${esc(t.text)}</p>`;
  if (t.art === 'marke') return `<p style="margin:0 0 16px;"><span style="display:inline-block;padding:6px 12px;border-radius:8px;background:${FLAECHE[t.farbe]};color:${FARBE[t.farbe]};font-weight:700;">${esc(t.text)}</span></p>`;
  if (t.art === 'liste')
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;">
${t.zeilen.map((z) => `<tr><td style="width:18px;vertical-align:top;padding:4px 0;color:${FARBE[z.farbe]};font-size:16px;line-height:1.5;">&#9679;</td><td style="padding:4px 0;font-size:16px;line-height:1.5;">${esc(z.text)}</td></tr>`).join('\n')}
</table>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
${t.paare.map(([name, wert]) => `<tr><td style="padding:4px 16px 4px 0;vertical-align:top;font-size:15px;line-height:1.5;color:#475569;white-space:nowrap;">${esc(name)}</td><td style="padding:4px 0;vertical-align:top;font-size:16px;line-height:1.5;">${esc(wert)}</td></tr>`).join('\n')}
</table>`;
}

/** Baut die gestaltete Fassung. Das Logo (helle Fassung aus „Erscheinungsbild“) hängt als Bild an der Mail. */
export function gestalteMail(k: Kontext, o: { teile: MailTeil[]; knopf?: { text: string; url: string }; fuss: string }): Pick<Mail, 'html' | 'bild'> {
  const betrieb = leseBetrieb(k.db).name;
  // Outlook zeigt kein WebP – dann lieber kein Bild als ein kaputtes
  const logo = logoBild(k.db);
  const bild = logo && logo.typ !== 'image/webp' ? { cid: 'logo@ausbildungsportal', typ: logo.typ, inhalt: logo.inhalt } : undefined;
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
${bild ? `<td style="padding-right:12px;vertical-align:middle;"><img src="cid:${bild.cid}" alt="${esc(betrieb ? `Logo ${betrieb}` : 'Logo')}" height="36" style="display:block;height:36px;width:auto;border:0;"></td>` : ''}
<td style="vertical-align:middle;"><div style="font-size:18px;font-weight:700;color:#2563eb;">Ausbildungsportal</div>${betrieb ? `<div style="font-size:13px;color:#475569;">${esc(betrieb)}</div>` : ''}</td>
</tr></table></td></tr>
<tr><td style="padding:24px 24px 8px;font-size:16px;line-height:1.5;">
${o.teile.map(teilHtml).join('\n')}
</td></tr>
${o.knopf ? `<tr><td style="padding:8px 24px 24px;"><a href="${esc(o.knopf.url)}" style="display:inline-block;padding:11px 18px;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">${esc(o.knopf.text)}</a></td></tr>` : ''}
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.5;color:#475569;">${esc(o.fuss)}</td></tr>
</table></td></tr></table></body></html>`;
  return { html, bild };
}
