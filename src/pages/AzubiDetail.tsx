import { melde, rueckfrage } from '../dialoge';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, berufName, datum, standText } from '../api';
import type { Konto, Profil, ProfilAntwort, Rolle, Stammdaten, ZuweisungZeile } from '../api';
import { geheZu, Link, useUngespeichert } from '../router';
import { AzubiReiter, ZurueckZuAzubis } from '../azubiReiter';
import { HandbuchLink } from '../handbuchLink';

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
/** Form des Berichtshefts in Worten */
const BERICHT_FORM: Record<'woche' | 'tag', string> = { woche: 'Woche im Ganzen', tag: 'Einträge je Tag' };

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
      <dt>Urlaubstage im Jahr</dt>
      <dd>{p.profil.urlaubstage ?? 'nicht eingetragen'}</dd>
      <dt>Berichtsheft</dt>
      <dd>
        {BERICHT_FORM[p.berichtFormGilt]}
        {p.profil.berichtForm === null ? ' (wie im Betrieb eingestellt)' : ''}
      </dd>
      <dt>Planer für die Prüfung</dt>
      <dd>{p.profil.planerFrei ? (p.planerTitel ? `„${p.planerTitel}“ freigeschaltet` : 'freigeschaltet – im Inhaltspaket des Berufs fehlt aber der Planer') : 'nicht freigeschaltet'}</dd>
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

function ProfilFormular({ p, stammdaten, ich, onGespeichert }: { p: ProfilAntwort; stammdaten: Stammdaten; ich: Konto; onGespeichert: () => Promise<void> }) {
  const [wert, setWert] = useState<Profil>(p.profil);
  const [meldung, setMeldung] = useState<Meldung>(null);
  useUngespeichert(JSON.stringify(wert) !== JSON.stringify(p.profil));
  const setze = <K extends keyof Profil>(k: K, v: Profil[K]) => setWert((alt) => ({ ...alt, [k]: v }));
  const idOderNull = (s: string) => (s ? Number(s) : null);

  const speichere = async (e: FormEvent) => {
    e.preventDefault();
    // Wer den Azubi an jemand anderen abgibt, sieht ihn danach nicht mehr – außer mit Gesamtsicht
    const neuer = stammdaten.ausbilder.find((a) => a.id === wert.ausbilderId);
    const gibtAb = !ich.alleAzubis && !!neuer && neuer.id !== ich.id && wert.ausbilderId !== p.profil.ausbilderId;
    if (gibtAb && !(await rueckfrage(`„${p.azubi.anzeigename}“ an ${neuer.anzeigename} abgeben?\n\nDanach ist ${neuer.anzeigename} zuständig. Du siehst diesen Azubi dann nicht mehr und kannst die Abgabe nicht selbst zurücknehmen.`, { ja: 'Azubi abgeben' }))) return;
    try {
      await api('PUT', `/api/azubis/${p.azubi.id}/profil`, wert);
      if (gibtAb) {
        melde(`${neuer.anzeigename} ist jetzt für „${p.azubi.anzeigename}“ zuständig.`);
        geheZu('/azubis', true);
        return;
      }
      await onGespeichert();
      setMeldung(null);
      melde('Gespeichert.');
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
            <option value="">– niemand –</option>
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
          Urlaubstage im Jahr
          <input type="number" min={0} max={60} step={1} value={wert.urlaubstage ?? ''} onChange={(e) => setze('urlaubstage', e.target.value === '' ? null : Number(e.target.value))} placeholder="z. B. 30" />
        </label>
        <label>
          Form des Berichtshefts
          <select value={wert.berichtForm ?? ''} onChange={(e) => setze('berichtForm', e.target.value === 'tag' || e.target.value === 'woche' ? e.target.value : null)}>
            <option value="">Wie im Betrieb eingestellt (zurzeit: {BERICHT_FORM[stammdaten.betrieb.berichtForm]})</option>
            <option value="woche">{BERICHT_FORM.woche}</option>
            <option value="tag">{BERICHT_FORM.tag}</option>
          </select>
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
      <fieldset className="abschnitt">
        <legend>Planer für die Prüfung</legend>
        <label className="haken">
          <input type="checkbox" checked={wert.planerFrei} disabled={!wert.planerFrei && (p.planerTitel === null || wert.berufId !== p.profil.berufId)} onChange={(e) => setze('planerFrei', e.target.checked)} />
          {p.planerTitel && wert.berufId === p.profil.berufId ? `Planer „${p.planerTitel}“ freischalten` : 'Planer freischalten'}
        </label>
        <p className="leise klein">
          {wert.berufId !== p.profil.berufId
            ? 'Du hast den Beruf geändert. Speichere erst das Profil – danach zeigt sich, ob es für den neuen Beruf einen Planer gibt.'
            : p.planerTitel === null
              ? 'Gesperrt: Für diesen Beruf gibt es noch keinen Planer. Er gehört als Datei „planer.md“ ins Inhaltspaket des Berufs.'
              : 'Der Azubi plant damit sein Prüfungsvorhaben. Was er einträgt, siehst du nicht – nur die Termine stehen in seinem Ausbildungsplan.'}{' '}
          <HandbuchLink kapitel="planer-freischalten">Planer freischalten</HandbuchLink>
        </p>
      </fieldset>
      <p className="leise klein">
        Fehlen Beruf oder Berufsschule in der Auswahl, lassen sie sich unter <Link zu="/verwaltung/stammdaten">Stammdaten</Link> anlegen. <HandbuchLink kapitel="profil">Das Profil eines Azubis</HandbuchLink>
      </p>
      <MeldungZeile m={meldung} />
      <div>
        <button className="knopf">Profil speichern</button>
      </div>
    </form>
  );
}

interface Person {
  id: number;
  anzeigename: string;
  rolle: Rolle;
}
interface AusAbteilung {
  beauftragter: string;
  von: string;
  bis: string;
  abteilung: string;
  stellvertretung: boolean;
}

function Zuweisungen({ azubiId, darfAendern }: { azubiId: number; darfAendern: boolean }) {
  const [zeilen, setZeilen] = useState<ZuweisungZeile[] | null>(null);
  // Zuweisungen aus Einsätzen in Abteilungen – nur zur Ansicht
  const [auto, setAuto] = useState<AusAbteilung[]>([]);
  const [personen, setPersonen] = useState<Person[]>([]);
  const [meldung, setMeldung] = useState<Meldung>(null);
  // Stand vom Server zum Vergleich – was davon abweicht, ist noch nicht gespeichert
  const [geladen, setGeladen] = useState('');
  useUngespeichert(zeilen !== null && geladen !== '' && JSON.stringify(zeilen) !== geladen);

  const lade = useCallback(async () => {
    const r = await api<{ zuweisungen: ZuweisungZeile[]; ausAbteilungen?: AusAbteilung[]; personen?: Person[] }>('GET', `/api/azubis/${azubiId}/zuweisungen`);
    setPersonen(r.personen ?? []);
    setAuto(r.ausAbteilungen ?? []);
    setZeilen(r.zuweisungen);
    setGeladen(JSON.stringify(r.zuweisungen));
  }, [azubiId]);

  useEffect(() => {
    lade().catch((e: Error) => setMeldung({ text: e.message, fehler: true }));
  }, [lade]);

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
      setMeldung(null);
      melde('Zuweisungen gespeichert.');
    } catch (err) {
      setMeldung({ text: err instanceof Error ? err.message : 'Fehler', fehler: true });
    }
  };

  if (zeilen === null) return <p className="leise">Lädt …</p>;

  const ausAbteilungen = auto.length > 0 && (
    <div className="abt-auto">
      <strong className="klein">Aus Einsätzen in Abteilungen (automatisch)</strong>
      <ul className="liste">
        {auto.map((z, i) => (
          <li key={i}>
            <strong>{z.beauftragter}</strong>
            {z.stellvertretung && ' (Stellvertretung)'} <span className="leise">{z.abteilung ? `${z.abteilung} · ` : ''}{datum(z.von)} bis {datum(z.bis)}</span>
          </li>
        ))}
      </ul>
      {darfAendern && <p className="leise klein">Diese Zuweisungen änderst du im Ausbildungsplan am Einsatz oder in den Stammdaten an der Abteilung.</p>}
    </div>
  );

  if (!darfAendern) {
    return zeilen.length === 0 && auto.length === 0 ? (
      <p className="leise">Keine Zuweisung eingetragen.</p>
    ) : zeilen.length === 0 ? (
      <>{ausAbteilungen}</>
    ) : (
      <>
      <ul className="liste">
        {zeilen.map((z, i) => (
          <li key={z.id ?? i}>
            <strong>{z.beauftragter}</strong>
            {z.rolle === 'ausbilder' && ' (Vertretung)'} <span className="leise">{z.von || z.bis ? `${z.von ? datum(z.von) : 'Beginn'} bis ${z.bis ? datum(z.bis) : 'Ende'}` : 'ganze Ausbildung'}</span>
          </li>
        ))}
      </ul>
        {ausAbteilungen}
      </>
    );
  }

  return (
    <>
      {ausAbteilungen}
      <p className="leise klein">
        Wer zugewiesen ist, sieht den Azubi ab dem Beginn und zeichnet Berichte der Wochen in seinem Zeitraum ab. Ohne Datum gilt die Zuweisung für die ganze Ausbildung.{' '}
        <HandbuchLink kapitel="zustaendig">Zuweisen und Vertretung</HandbuchLink>
      </p>
      {personen.length === 0 && <p className="hinweis">Es gibt noch kein Konto, das sich zuweisen lässt (Ausbildungsbeauftragte oder ein weiterer Ausbilder).</p>}
      {zeilen.map((z, i) => (
        <div className="reihe zuweisung" key={i}>
          <label>
            Person
            <select value={z.beauftragter_id || ''} onChange={(e) => aendere(i, { beauftragter_id: Number(e.target.value) })}>
              <option value="">– bitte wählen –</option>
              {(['beauftragter', 'ausbilder'] as const).map((rolle) => {
                const gruppe = personen.filter((b) => b.rolle === rolle);
                return (
                  gruppe.length > 0 && (
                    <optgroup key={rolle} label={rolle === 'beauftragter' ? 'Ausbildungsbeauftragte' : 'Ausbilder (als Vertretung)'}>
                      {gruppe.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.anzeigename}
                        </option>
                      ))}
                    </optgroup>
                  )
                );
              })}
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

export function AzubiDetail({ id, ich }: { id: number; ich: Konto }) {
  const [p, setP] = useState<ProfilAntwort | null>(null);
  const [stammdaten, setStammdaten] = useState<Stammdaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);

  const lade = useCallback(async () => {
    setP(await api<ProfilAntwort>('GET', `/api/azubis/${id}/profil`));
  }, [id]);

  useEffect(() => {
    lade().catch((e: Error) => setFehler(e.message));
    api<Stammdaten>('GET', '/api/stammdaten').then(setStammdaten, () => {});
  }, [lade]);

  const uebernimm = async () => {
    if (!p) return;
    if (!(await rueckfrage(`„${p.azubi.anzeigename}“ übernehmen?\n\nDu bist dann zuständig. Andere Ausbilder sehen diesen Azubi nicht mehr – außer als Vertretung oder mit Gesamtsicht.`, { ja: 'Azubi übernehmen' }))) return;
    try {
      await api('POST', `/api/azubis/${id}/uebernehmen`);
      await lade();
      setMeldung(null);
      melde(`Du bist jetzt für „${p.azubi.anzeigename}“ zuständig.`);
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : 'Fehler', fehler: true });
    }
  };

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
      <ZurueckZuAzubis />
      <h1>{p.azubi.anzeigename}</h1>
      <AzubiReiter id={p.azubi.id} name={p.azubi.anzeigename} />
      <p className="leise">
        {p.azubi.anmeldename}
        {p.azubi.status === 'gesperrt' && <span className="pille grau">gesperrt</span>}
      </p>

      {p.betreuung === 'ohne' && (
        <div className="hinweis">
          <p>
            <strong>Dieser Azubi hat noch keinen zuständigen Ausbilder.</strong> Bis jemand übernimmt, sehen und bearbeiten ihn alle Ausbilder.
          </p>
          <div className="aktionen links">
            <button type="button" className="knopf" onClick={() => void uebernimm()}>
              Azubi übernehmen
            </button>
          </div>
          <MeldungZeile m={meldung} />
        </div>
      )}
      {p.betreuung === 'gesamt' && (
        <p className="hinweis">
          Zuständig ist {p.ausbilder?.anzeigename ?? 'ein anderer Ausbilder'}. Du siehst diesen Azubi, weil dein Konto die Gesamtsicht über alle Azubis hat.
        </p>
      )}
      {p.betreuung === 'vertretung' && (
        <p className="hinweis">
          <strong>Vertretung:</strong> Zuständig ist {p.ausbilder?.anzeigename ?? 'ein anderer Ausbilder'}. Du zeichnest Berichte der Wochen in deinem Zeitraum ab und trägst Aufgaben und Notizen ein. Profil, Einsätze
          und Zuweisungen ändert der zuständige Ausbilder.
        </p>
      )}

      <section className="karte">
        <h2>Ausbildung</h2>
        <ProfilUebersicht p={p} />
      </section>

      {p.bearbeitbar && stammdaten && (
        <section className="karte">
          <h2>Profil bearbeiten</h2>
          <ProfilFormular key={p.azubi.id + ':' + (p.profil.ausbilderId ?? 0)} p={p} stammdaten={stammdaten} ich={ich} onGespeichert={lade} />
        </section>
      )}

      <section className="karte">
        <h2>Ausbildungsbeauftragte und Vertretung</h2>
        <Zuweisungen azubiId={p.azubi.id} darfAendern={p.bearbeitbar} />
      </section>
    </>
  );
}
