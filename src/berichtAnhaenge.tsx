import { useRef, useState } from 'react';
import { api, ApiFehler, ladeDatei, ladeHoch } from './api';
import type { BerichtAnhang } from './api';
import { melde, rueckfrage } from './dialoge';
import { Icon } from './icons';

/**
 * Anhänge an einem Bericht: Fotos und Dateien zu dem, was der Azubi gemacht hat.
 * - Tagesform: je Tag eine Liste (tag = Datum). Wochenform: eine Liste für den ganzen Bericht (tag = null).
 * - Ein Anhang wird sofort gespeichert und sofort gelöscht – unabhängig vom „Speichern“ des Berichts.
 * - Große Fotos verkleinert der Browser vor dem Hochladen, damit sie unter die Grenze passen.
 */
const MAX = 5 * 1024 * 1024;
const ERLAUBT = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp';
const AB_HIER_VERKLEINERN = 1.5 * 1024 * 1024;
const LANGE_SEITE = 2400;

export const groesseText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Große JPEG-, PNG- und WebP-Fotos auf höchstens 2400 px an der langen Seite bringen. Klappt das nicht, bleibt die Datei, wie sie ist. */
async function verkleinere(datei: File): Promise<{ blob: Blob; name: string }> {
  const unveraendert = { blob: datei, name: datei.name };
  if (!/^image\/(jpeg|png|webp)$/.test(datei.type) || datei.size <= AB_HIER_VERKLEINERN) return unveraendert;
  try {
    const bild = await createImageBitmap(datei);
    const faktor = Math.min(1, LANGE_SEITE / Math.max(bild.width, bild.height));
    const flaeche = document.createElement('canvas');
    flaeche.width = Math.round(bild.width * faktor);
    flaeche.height = Math.round(bild.height * faktor);
    const stift = flaeche.getContext('2d');
    if (!stift) return unveraendert;
    // weißer Grund, falls das Bild durchsichtige Stellen hat – JPEG kennt keine
    stift.fillStyle = '#ffffff';
    stift.fillRect(0, 0, flaeche.width, flaeche.height);
    stift.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
    bild.close();
    const blob = await new Promise<Blob | null>((fertig) => flaeche.toBlob(fertig, 'image/jpeg', 0.85));
    if (!blob || blob.size >= datei.size) return unveraendert;
    return { blob, name: datei.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch {
    return unveraendert;
  }
}

export function Anhaenge({
  pfad,
  liste,
  tag,
  schreibbar,
  wo,
  vorher,
  onGeaendert,
}: {
  /** /api/azubis/<id>/berichte/<montag> */
  pfad: string;
  /** alle Anhänge des Berichts – gezeigt werden die zu `tag` */
  liste: BerichtAnhang[];
  tag: string | null;
  schreibbar: boolean;
  /** wozu die Anhänge gehören, für Vorleseprogramme und Meldungen: „Montag“ oder „diesem Bericht“ */
  wo: string;
  /** vor dem Hochladen: Bericht speichern, falls nötig; false bricht ab */
  vorher?: () => Promise<boolean>;
  onGeaendert?: (liste: BerichtAnhang[]) => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const datei = useRef<HTMLInputElement>(null);
  const foto = useRef<HTMLInputElement>(null);
  const eigene = liste.filter((a) => a.tag === tag);
  const adresse = (a: BerichtAnhang) => `${pfad}/anhaenge/${a.id}`;

  const ladeHochAlle = async (dateien: File[]) => {
    if (dateien.length === 0) return;
    setFehler('');
    setLaeuft(true);
    try {
      if (vorher && !(await vorher())) return;
      let neu: BerichtAnhang[] | null = null;
      for (const d of dateien) {
        const { blob, name } = await verkleinere(d);
        if (blob.size > MAX) throw new ApiFehler(413, `„${d.name}“ ist zu groß (${groesseText(blob.size)}). Höchstens 5 MB je Datei.`);
        neu = (await ladeHoch<{ anhaenge: BerichtAnhang[] }>(`${pfad}/anhaenge?name=${encodeURIComponent(name)}${tag ? `&tag=${tag}` : ''}`, blob, 'application/octet-stream')).anhaenge;
        onGeaendert?.(neu);
      }
      melde(dateien.length === 1 ? 'Anhang gespeichert.' : `${dateien.length} Anhänge gespeichert.`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Anhang wurde nicht gespeichert.');
    } finally {
      setLaeuft(false);
    }
  };

  const loesche = async (a: BerichtAnhang) => {
    if (!(await rueckfrage(`Anhang löschen?\n\n„${a.name}“ wird sofort und endgültig entfernt.`, { ja: 'Anhang löschen', gefahr: true }))) return;
    setFehler('');
    setLaeuft(true);
    try {
      onGeaendert?.((await api<{ anhaenge: BerichtAnhang[] }>('DELETE', adresse(a))).anhaenge);
      melde('Anhang gelöscht.');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Der Anhang wurde nicht gelöscht.');
    } finally {
      setLaeuft(false);
    }
  };

  const hole = async (a: BerichtAnhang) => {
    setFehler('');
    try {
      await ladeDatei(adresse(a));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Datei ließ sich nicht herunterladen.');
    }
  };

  const gewaehlt = (feld: HTMLInputElement) => {
    const dateien = [...(feld.files ?? [])];
    feld.value = ''; // dieselbe Datei soll sich noch einmal wählen lassen
    void ladeHochAlle(dateien);
  };

  if (!schreibbar && eigene.length === 0) return null;
  return (
    <div className="anhaenge">
      {eigene.length > 0 && (
        <ul className="anhang-liste" aria-label={`Anhänge zu ${wo}`}>
          {eigene.map((a) => (
            <li key={a.id}>
              {a.vorschau ? (
                <a className="anhang-bild" href={adresse(a)} target="_blank" rel="noreferrer" title={`${a.name} in neuem Fenster öffnen`}>
                  <img src={adresse(a)} alt={`Foto: ${a.name}`} loading="lazy" />
                </a>
              ) : (
                <span className="anhang-symbol" aria-hidden="true">
                  <Icon name={a.art === 'bild' ? 'bild' : 'pdf'} groesse={28} />
                </span>
              )}
              <span className="anhang-text">
                <span className="anhang-name">{a.name}</span>
                <span className="leise klein">{groesseText(a.groesse)}</span>
              </span>
              <span className="anhang-knoepfe">
                {!a.vorschau && (
                  <button type="button" className="knopf schlicht klein" onClick={() => void hole(a)}>
                    Herunterladen<span className="nur-vorleser">: {a.name}</span>
                  </button>
                )}
                {schreibbar && (
                  <button type="button" className="knopf schlicht klein gefahr" disabled={laeuft} onClick={() => void loesche(a)}>
                    Löschen<span className="nur-vorleser">: {a.name}</span>
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {fehler && (
        <p className="hinweis fehler" role="alert">
          {fehler}
        </p>
      )}
      {schreibbar && (
        <div className="aktionen links anhang-neu">
          <input ref={foto} className="nur-vorleser" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={(e) => gewaehlt(e.target)} />
          <input ref={datei} className="nur-vorleser" type="file" accept={ERLAUBT} multiple tabIndex={-1} aria-hidden="true" onChange={(e) => gewaehlt(e.target)} />
          <button type="button" className="knopf schlicht klein anhang-foto" disabled={laeuft} onClick={() => foto.current?.click()}>
            Foto aufnehmen<span className="nur-vorleser"> für {wo}</span>
          </button>
          <button type="button" className="knopf schlicht klein" disabled={laeuft} onClick={() => datei.current?.click()}>
            {laeuft ? 'Wird gespeichert …' : 'Foto oder Datei anhängen'}
            <span className="nur-vorleser"> für {wo}</span>
          </button>
        </div>
      )}
    </div>
  );
}
