import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, berufName, datum, standText } from '../api';
import type { Konto, Profil, ProfilAntwort, Stammdaten, ZuweisungZeile } from '../api';
import { Link } from '../router';

type Meldung = { text: string; fehler: boolean } | null;

function MeldungZeile({ m }: { m: Meldung }) {
  if (!m) return null;
  return (
    <p className={`hinweis ${m.fehler ? 'fehler' : 'gut'}`} role={m.fehler ? 'alert' : 'status'}>
      {m.text}
    </p>
  );
}

/** Kopf mit dem Wichtigsten zur Ausbildung – auch auf der Startseite des Azubis. */
export function ProfilUebersicht({ p }: { p: ProfilAntwort }) {
  return (
    <dl className="daten">
      <dt>Stand</dt>
      <dd>{standText(p.stand)}</dd>
      <dt>Ausbildungsberuf</dt>
      <dd>{berufName(p.beruf) || '–'}</dd>
      <dt>Berufsschule</dt>
      <dd>{p.berufsschule ? [p.berufsschule.name, p.berufsschule.ort].filter(Boolean).join(', ') : '–'}</dd>
      <dt>Zuständiger Ausbilder</dt>
      <dd>{p.ausbilder?.anzeigename ?? '–'}</dd>
      <dt>Ausbildungszeit</dt>
      <dd>
        {p.stand.beginn ? `${datum(p.stand.beginn)} bis ${datum(p.stand.ende)} (${p.stand.monate} Monate${p.stand.endeVonHand ? ', Ende laut Vertrag' : ''})` : '–'}
      </dd>
      {p.profil.verkuerzungMonate > 0 && (
        <>
          <dt>Verkürzung</dt>
          <dd>
            {p.profil.verkuerzungMonate} Monate{p.profil.verkuerzungArt === 'anfang' ? ', am Anfang angerechnet' : ''}
            {p.profil.verkuerzungGrund ? ` (${p.profil.verkuerzungGrund})` : ''}
          </dd>
        </>
      )}
      <dt>Wochenstunden</dt>
      <dd>{String(p.profil.wochenstunden).replace('.', ',')}</dd>
      {p.profil.pruefungen.length > 0 && (
        <>
          <dt>Prüfungen</dt>
          <dd>
            {p.profil.pruefungen.map((x) => (
              <div key={x.bezeichnung + x.datum}>
                {x.bezeichnung}: {datum(x.datum)}
              </div>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

function ProfilFormular({ p, stammdaten, onGespeichert }: { p: ProfilAntwort; stammdaten: Stammdaten; onGespeichert: () => Promise<void> }) {
  const [wert, setWert] = useState<Profil>(p.profil);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const setze = <K extends keyof Profil>(k: K, v: Profil[K]) => setWert((alt) => ({ ...alt, [k]: v }));
  const idOderNull = (s: string) => (s ? Number(s) : null);

  const speichere = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('PUT', `/api/azubis/${p.azubi.id}/profil`, wert);
      await onGespeichert();
      setMeldung({ text: 'Gespeichert.', fehler: false });
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  return (
    <form onSubmit={speichere}>
      <div className="raster">
        <label>
          Ausbildungsberuf
          <select value={wert.berufId ?? ''} onChange={(e) => setze('berufId', idOderNull(e.target.value))}>
            <option value="">– noch nicht festgelegt –</option>
            {stammdaten.berufe.map((b) => (
              <option key={b.id} value={b.id}>
                {berufName(b)} ({b.regeldauer_monate} Monate)
              </option>
            ))}
          </select>
        </label>
        <label>
          Berufsschule
          <select value={wert.berufsschuleId ?? ''} onChange={(e) => setze('berufsschuleId', idOderNull(e.target.value))}>
            <option value="">– noch nicht festgelegt –</option>
            {stammdaten.berufsschulen.map((s) => (
              <option key={s.id} value={s.id}>
                {[s.name, s.ort].filter(Boolean).join(', ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zuständiger Ausbilder
          <select value={wert.ausbilderId ?? ''} onChange={(e) => setze('ausbilderId', idOderNull(e.target.value))}>
            <option value="">– noch nicht festgelegt –</option>
            {stammdaten.ausbilder.map((a) => (
              <option key={a.id} value={a.id}>
                {a.anzeigename}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wochenstunden
          <input type="number" min={1} max={60} step={0.25} value={wert.wochenstunden} onChange={(e) => setze('wochenstunden', Number(e.target.value))} required />
        </label>
        <label>
          Ausbildungsbeginn
          <input type="date" value={wert.ausbildungsbeginn} onChange={(e) => setze('ausbildungsbeginn', e.target.value)} />
        </label>
        <label>
          Vertragsende (nur wenn es vom berechneten Ende abweicht)
          <input type="date" value={wert.vertragsende} onChange={(e) => setze('vertragsende', e.target.value)} />
        </label>
        <label>
          Verkürzung in Monaten (höchstens {p.hoechsteVerkuerzung})
          <input type="number" min={0} max={p.hoechsteVerkuerzung} step={1} value={wert.verkuerzungMonate} onChange={(e) => setze('verkuerzungMonate', Number(e.target.value))} />
        </label>
        <label>
          Art der Verkürzung
          <select value={wert.verkuerzungArt} onChange={(e) => setze('verkuerzungArt', e.target.value as Profil['verkuerzungArt'])}>
            <option value="ende">Ausbildung endet früher</option>
            <option value="anfang">Am Anfang angerechnet (Start in höherem Ausbildungsjahr)</option>
          </select>
        </label>
        <label>
          Grund der Verkürzung
          <input value={wert.verkuerzungGrund} maxLength={200} placeholder="z. B. Abitur" onChange={(e) => setze('verkuerzungGrund', e.target.value)} />
        </label>
        <label className="haken">
          <input type="checkbox" checked={wert.vorzeitigeZulassung} onChange={(e) => setze('vorzeitigeZulassung', e.target.checked)} />
          Vorzeitige Zulassung zur Abschlussprüfung
        </label>
      </div>
      <fieldset className="abschnitt">
        <legend>Prüfungstermine</legend>
        <p className="leise klein">Erscheinen im Ausbildungsplan des Azubis. Die Bezeichnung ist frei, z. B. „Abschlussprüfung Teil 1“ oder „Zwischenprüfung“.</p>
        {wert.pruefungen.map((x, i) => (
          <div className="zeile drei" key={i}>
            <input aria-label={`Bezeichnung der Prüfung ${i + 1}`} value={x.bezeichnung} maxLength={80} placeholder="Bezeichnung" onChange={(e) => setze('pruefungen', wert.pruefungen.map((y, j) => (j === i ? { ...y, bezeichnung: e.target.value } : y)))} />
            <input type="date" aria-label={`Datum der Prüfung ${i + 1}`} value={x.datum} onChange={(e) => setze('pruefungen', wert.pruefungen.map((y, j) => (j === i ? { ...y, datum: e.target.value } : y)))} />
            <button type="button" className="knopf schlicht" onClick={() => setze('pruefungen', wert.pruefungen.filter((_, j) => j !== i))}>
              Entfernen
            </button>
          </div>
        ))}
        <button
          type="button"
          className="knopf schlicht"
          disabled={wert.pruefungen.length >= 8}
          onClick={() => setze('pruefungen', [...wert.pruefungen, { bezeichnung: ['Abschlussprüfung Teil 1', 'Abschlussprüfung Teil 2'][wert.pruefungen.length] ?? '', datum: '' }])}
        >
          Prüfungstermin hinzufügen
        </button>
      </fieldset>
      <p className="leise klein">
        Fehlen Beruf oder Berufsschule in der Auswahl, lassen sie sich unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> anlegen. Die App rechnet nur mit den
        eingetragenen Monaten; ob eine Verkürzung zulässig ist, entscheidet die zuständige Kammer.
      </p>
      <MeldungZeile m={meldung} />
      <div>
        <button className="knopf">Profil speichern</button>
      </div>
    </form>
  );
}

function Zuweisungen({ azubiId, darfAendern }: { azubiId: number; darfAendern: boolean }) {
  const [zeilen, setZeilen] = useState<ZuweisungZeile[] | null>(null);
  const [beauftragte, setBeauftragte] = useState<Konto[]>([]);
  const [meldung, setMeldung] = useState<Meldung>(null);

  const lade = useCallback(async () => {
    const r = await api<{ zuweisungen: ZuweisungZeile[] }>('GET', `/api/azubis/${azubiId}/zuweisungen`);
    setZeilen(r.zuweisungen);
  }, [azubiId]);

  useEffect(() => {
    lade().catch((e: Error) => setMeldung({ text: e.message, fehler: true }));
    if (darfAendern) {
      api<{ konten: Konto[] }>('GET', '/api/konten').then((r) => setBeauftragte(r.konten.filter((k) => k.rolle === 'beauftragter')), () => {});
    }
  }, [lade, darfAendern]);

  const aendere = (i: number, teil: Partial<ZuweisungZeile>) => {
    setZeilen((alt) => (alt ?? []).map((z, j) => (j === i ? { ...z, ...teil } : z)));
    setMeldung(null);
  };

  const speichere = async () => {
    try {
      await api('PUT', `/api/azubis/${azubiId}/zuweisungen`, {
        zuweisungen: (zeilen ?? []).map((z) => ({ beauftragterId: z.beauftragter_id, von: z.von || null, bis: z.bis || null })),
      });
      await lade();
      setMeldung({ text: 'Zuweisungen gespeichert.', fehler: false });
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  if (zeilen === null) return <p className="leise">Lädt …</p>;

  if (!darfAendern) {
    return zeilen.length === 0 ? (
      <p className="leise">Keine Zuweisung eingetragen.</p>
    ) : (
      <ul className="liste">
        {zeilen.map((z, i) => (
          <li key={z.id ?? i}>
            <strong>{z.beauftragter}</strong> <span className="leise">{z.von || z.bis ? `${z.von ? datum(z.von) : 'Beginn'} bis ${z.bis ? datum(z.bis) : 'Ende'}` : 'ganze Ausbildung'}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <p className="leise klein">
        Ausbildungsbeauftragte sehen den Azubi ab dem Beginn der Zuweisung und zeichnen nur Wochen in ihrem Zeitraum ab. Ohne Datum gilt die Zuweisung für die ganze
        Ausbildung.
      </p>
      {beauftragte.length === 0 && <p className="hinweis">Es gibt noch kein Konto mit der Rolle Ausbildungsbeauftragte.</p>}
      {zeilen.map((z, i) => (
        <div className="reihe zuweisung" key={i}>
          <label>
            Ausbildungsbeauftragte
            <select value={z.beauftragter_id || ''} onChange={(e) => aendere(i, { beauftragter_id: Number(e.target.value) })}>
              <option value="">– bitte wählen –</option>
              {beauftragte.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.anzeigename}
                </option>
              ))}
            </select>
          </label>
          <label>
            Von
            <input type="date" value={z.von ?? ''} onChange={(e) => aendere(i, { von: e.target.value || null })} />
          </label>
          <label>
            Bis
            <input type="date" value={z.bis ?? ''} onChange={(e) => aendere(i, { bis: e.target.value || null })} />
          </label>
          <button type="button" className="knopf schlicht gefahr" onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      <MeldungZeile m={meldung} />
      <div className="aktionen links">
        <button type="button" className="knopf schlicht" onClick={() => setZeilen([...zeilen, { beauftragter_id: 0, von: null, bis: null }])}>
          Zuweisung hinzufügen
        </button>
        <button type="button" className="knopf" onClick={() => void speichere()} disabled={zeilen.some((z) => !z.beauftragter_id)}>
          Zuweisungen speichern
        </button>
      </div>
    </>
  );
}

export function AzubiDetail({ id }: { id: number }) {
  const [p, setP] = useState<ProfilAntwort | null>(null);
  const [stammdaten, setStammdaten] = useState<Stammdaten | null>(null);
  const [fehler, setFehler] = useState('');

  const lade = useCallback(async () => {
    setP(await api<ProfilAntwort>('GET', `/api/azubis/${id}/profil`));
  }, [id]);

  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
    api<Stammdaten>('GET', '/api/stammdaten').then(setStammdaten, () => {});
  }, [lade]);

  if (fehler) {
    return (
      <>
        <h1>Azubi nicht gefunden</h1>
        <p>
          <Link zu="/azubis">Zur Liste der Azubis</Link>
        </p>
      </>
    );
  }
  if (!p) return <p className="leise">Lädt …</p>;

  return (
    <>
      <p className="klein">
        <Link zu="/azubis">← Alle Azubis</Link>
      </p>
      <h1>{p.azubi.anzeigename}</h1>
      <p className="leise">
        {p.azubi.anmeldename}
        {p.azubi.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
      </p>

      <section className="karte">
        <h2>Ausbildung</h2>
        <ProfilUebersicht p={p} />
        <p className="abstand">
          <Link zu={`/azubis/${p.azubi.id}/berichtsheft`} className="knopf schlicht">
            Berichtsheft ansehen
          </Link>{' '}
          <Link zu={`/azubis/${p.azubi.id}/plan`} className="knopf schlicht">
            Ausbildungsplan
          </Link>
        </p>
      </section>

      {p.bearbeitbar && stammdaten && (
        <section className="karte">
          <h2>Profil bearbeiten</h2>
          <ProfilFormular key={p.azubi.id} p={p} stammdaten={stammdaten} onGespeichert={lade} />
        </section>
      )}

      <section className="karte">
        <h2>Ausbildungsbeauftragte</h2>
        <Zuweisungen azubiId={p.azubi.id} darfAendern={p.bearbeitbar} />
      </section>
    </>
  );
}
