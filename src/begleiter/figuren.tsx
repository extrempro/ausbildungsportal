import type { ReactNode } from 'react';

/**
 * Die Figuren des Begleiters und ihr Zubehör – selbst gezeichnet (keine fremden Vorlagen), als SVG im Feld 120 × 120.
 * Farben kommen aus den Variablen --bf-… in src/index.css (hell und dunkel). Jedes Teil ist für den Biber gezeichnet;
 * LAGE verschiebt und skaliert es je Figur an seinen Platz.
 */
export const FIGUREN = ['eule', 'fuchs', 'roboter', 'biber', 'pinguin'] as const;
export type Figur = (typeof FIGUREN)[number];

export const FIGUR_NAME: Record<Figur, string> = { eule: 'Eule', fuchs: 'Fuchs', roboter: 'Roboter', biber: 'Biber', pinguin: 'Pinguin' };
export const FIGUR_ART: Record<Figur, string> = { eule: 'ruhig, weiß viel', fuchs: 'neugierig, flink', roboter: 'technisch, hilfsbereit', biber: 'baut gern, packt an', pinguin: 'gelassen, bleibt cool' };

/** Zubehör in der Reihenfolge, in der der Begleiter es bekommt (Stufe 1 bis 9). */
export const TEILE = ['ausweis', 'muetze', 'schal', 'schluessel', 'brille', 'becher', 'guertel', 'schuhe', 'hut'] as const;
export type Teil = (typeof TEILE)[number];

export const TEIL_NAME: Record<Teil, string> = { ausweis: 'Ausweis am Band', muetze: 'Mütze', schal: 'Schal', schluessel: 'Werkzeug', brille: 'Brille', becher: 'Becher', guertel: 'Werkzeuggürtel', schuhe: 'Sicherheitsschuhe', hut: 'Abschlusshut' };

/** Reihenfolge beim Zeichnen: was später kommt, liegt oben. */
const ZEICHNE: Teil[] = ['schuhe', 'guertel', 'ausweis', 'schal', 'becher', 'schluessel', 'brille', 'muetze', 'hut'];

const KOERPER: Record<Figur, ReactNode> = {
  eule: (
    <>
      <path className="bf-l" fill="var(--bf-eule)" d="M28 50 L24 22 L44 34 Q60 28 76 34 L96 22 L92 50 Q100 72 92 92 Q80 110 60 110 Q40 110 28 92 Q20 72 28 50Z"/>
      <ellipse className="bf-l" fill="var(--bf-eule2)" cx="60" cy="84" rx="20" ry="20"/>
      <path className="bf-l" fill="none" d="M50 80 q5 5 10 0 q5 5 10 0 M52 92 q4 4 8 0 q4 4 8 0"/>
      <circle className="bf-l" fill="var(--bf-weiss)" cx="45" cy="56" r="13"/><circle className="bf-l" fill="var(--bf-weiss)" cx="75" cy="56" r="13"/>
      <circle fill="var(--bf-linie)" cx="47" cy="57" r="5"/><circle fill="var(--bf-linie)" cx="73" cy="57" r="5"/>
      <circle fill="var(--bf-weiss)" cx="49" cy="55" r="1.6"/><circle fill="var(--bf-weiss)" cx="75" cy="55" r="1.6"/>
      <path className="bf-l" fill="var(--bf-schnabel)" d="M54 64 L66 64 L60 73Z"/>
      <path className="bf-l" fill="var(--bf-eule)" d="M27 70 Q14 82 26 96 M93 70 Q106 82 94 96"/>
      <path className="bf-l" fill="var(--bf-schnabel)" d="M46 110 l-4 6 m8 -6 v6 m20 -6 v6 m8 -6 l4 6"/>
    </>
  ),
  fuchs: (
    <>
      <path className="bf-l" fill="var(--bf-fuchs)" d="M84 96 Q112 92 106 66 Q100 80 86 82Z"/>
      <path className="bf-l" fill="var(--bf-fuchs2)" d="M106 66 Q108 76 100 82 Q104 72 106 66Z"/>
      <path className="bf-l" fill="var(--bf-fuchs)" d="M38 76 Q34 110 60 110 Q86 110 82 76Z"/>
      <path className="bf-l" fill="var(--bf-fuchs2)" d="M50 84 Q60 108 70 84Z"/>
      <path className="bf-l" fill="var(--bf-fuchs)" d="M22 44 L26 12 L46 28 Q60 24 74 28 L94 12 L98 44 Q98 62 60 80 Q22 62 22 44Z"/>
      <path className="bf-l" fill="var(--bf-fuchs2)" d="M24 50 Q40 52 60 80 Q80 52 96 50 Q94 64 60 80 Q26 64 24 50Z"/>
      <path fill="var(--bf-fuchs3)" d="M30 20 L40 30 L31 34Z M90 20 L80 30 L89 34Z"/>
      <circle fill="var(--bf-linie)" cx="44" cy="46" r="4.5"/><circle fill="var(--bf-linie)" cx="76" cy="46" r="4.5"/>
      <circle fill="var(--bf-weiss)" cx="45.5" cy="44.5" r="1.4"/><circle fill="var(--bf-weiss)" cx="77.5" cy="44.5" r="1.4"/>
      <ellipse fill="var(--bf-linie)" cx="60" cy="72" rx="5" ry="3.6"/>
      <circle fill="var(--bf-wange)" opacity=".7" cx="34" cy="56" r="4"/><circle fill="var(--bf-wange)" opacity=".7" cx="86" cy="56" r="4"/>
      <path className="bf-l" fill="none" d="M46 110 v6 m28 -6 v6"/>
      <path className="bf-l" fill="none" d="M41 86 Q31 89 35 98 M79 86 Q89 89 85 98"/>
    </>
  ),
  roboter: (
    <>
      <path className="bf-l" fill="none" d="M60 22 V12"/><circle className="bf-l" fill="var(--bf-licht)" cx="60" cy="9" r="5"/>
      <rect className="bf-l" fill="var(--bf-robo)" x="24" y="22" width="72" height="50" rx="16"/>
      <rect className="bf-l" fill="var(--bf-robo2)" x="33" y="31" width="54" height="32" rx="11"/>
      <circle fill="var(--bf-robo3)" cx="48" cy="45" r="5"/><circle fill="var(--bf-robo3)" cx="72" cy="45" r="5"/>
      <path className="bf-l" stroke="var(--bf-robo3)" fill="none" d="M52 55 q8 6 16 0" style={{ stroke: 'var(--bf-robo3)' }}/>
      <rect className="bf-l" fill="var(--bf-robo)" x="15" y="38" width="9" height="18" rx="4"/><rect className="bf-l" fill="var(--bf-robo)" x="96" y="38" width="9" height="18" rx="4"/>
      <rect className="bf-l" fill="var(--bf-robo)" x="36" y="76" width="48" height="30" rx="10"/>
      <circle className="bf-l" fill="var(--bf-licht)" cx="60" cy="90" r="6"/>
      <path className="bf-l" fill="none" d="M36 84 Q22 86 22 98 M84 84 Q98 86 98 74"/>
      <circle className="bf-l" fill="var(--bf-robo2)" cx="22" cy="101" r="4"/><circle className="bf-l" fill="var(--bf-robo2)" cx="98" cy="71" r="4"/>
      <path className="bf-l" fill="none" d="M48 106 v8 m24 -8 v8"/><path className="bf-l" fill="none" d="M42 115 h12 m12 0 h12"/>
    </>
  ),
  biber: (
    <>
      <g transform="rotate(-24 92 98)"><ellipse className="bf-l" fill="var(--bf-biber3)" cx="94" cy="98" rx="17" ry="9"/>
      <path fill="none" stroke="var(--bf-biber)" strokeWidth="1.8" strokeLinecap="round" d="M84 93 l6 10 M92 91 l6 12 M100 92 l5 9 M82 101 l8 -9 M90 105 l9 -12 M99 105 l6 -9"/></g>
      <circle className="bf-l" fill="var(--bf-biber)" cx="35" cy="27" r="8"/><circle className="bf-l" fill="var(--bf-biber)" cx="85" cy="27" r="8"/>
      <circle fill="var(--bf-biber3)" cx="35" cy="27" r="3.5"/><circle fill="var(--bf-biber3)" cx="85" cy="27" r="3.5"/>
      <path className="bf-l" fill="var(--bf-biber)" d="M40 72 Q32 110 60 110 Q88 110 80 72Z"/>
      <ellipse className="bf-l" fill="var(--bf-biber2)" cx="60" cy="94" rx="12" ry="12"/>
      <ellipse className="bf-l" fill="var(--bf-biber)" cx="60" cy="48" rx="32" ry="27"/>
      <ellipse className="bf-l" fill="var(--bf-biber2)" cx="60" cy="58" rx="16" ry="11"/>
      <rect className="bf-l" fill="var(--bf-weiss)" x="53.5" y="61" width="13" height="11" rx="2.5"/><path className="bf-l" fill="none" d="M60 61 v11"/>
      <ellipse fill="var(--bf-linie)" cx="60" cy="53" rx="6.5" ry="4.2"/>
      <circle fill="var(--bf-linie)" cx="46" cy="42" r="4.5"/><circle fill="var(--bf-linie)" cx="74" cy="42" r="4.5"/>
      <circle fill="var(--bf-weiss)" cx="47.5" cy="40.5" r="1.4"/><circle fill="var(--bf-weiss)" cx="75.5" cy="40.5" r="1.4"/>
      <circle fill="var(--bf-wange)" opacity=".7" cx="36" cy="54" r="4"/><circle fill="var(--bf-wange)" opacity=".7" cx="84" cy="54" r="4"/>
      <path className="bf-l" fill="none" d="M41 82 Q32 86 36 94 M79 82 Q88 86 84 94"/>
      <path className="bf-l" fill="var(--bf-biber3)" d="M42 110 q6 -5 12 0 v4 h-12Z M66 110 q6 -5 12 0 v4 h-12Z"/>
    </>
  ),
  pinguin: (
    <>
      <path className="bf-l" fill="var(--bf-schnabel)" d="M40 108 q8 -7 16 0 v5 h-16Z M64 108 q8 -7 16 0 v5 h-16Z"/>
      <path className="bf-l" fill="var(--bf-pingu)" d="M30 58 Q12 76 22 96 Q30 88 34 74Z M90 58 Q108 76 98 96 Q90 88 86 74Z"/>
      <path className="bf-l" fill="var(--bf-pingu)" d="M60 20 Q92 20 92 62 Q92 108 60 108 Q28 108 28 62 Q28 20 60 20Z"/>
      <path className="bf-l" fill="var(--bf-pingu2)" d="M60 36 Q50 28 42 34 Q34 42 38 58 Q34 96 60 100 Q86 96 82 58 Q86 42 78 34 Q70 28 60 36Z"/>
      <path className="bf-l" fill="none" d="M56 20 q2 -8 8 -9 M61 20 q4 -5 9 -3"/>
      <circle fill="var(--bf-auge)" cx="49" cy="48" r="4.5"/><circle fill="var(--bf-auge)" cx="71" cy="48" r="4.5"/>
      <circle fill="var(--bf-glanz)" cx="50.5" cy="46.5" r="1.4"/><circle fill="var(--bf-glanz)" cx="72.5" cy="46.5" r="1.4"/>
      <path className="bf-l" fill="var(--bf-schnabel)" d="M52 56 Q60 51 68 56 Q60 67 52 56Z"/>
      <circle fill="var(--bf-wange)" opacity=".75" cx="42" cy="58" r="4"/><circle fill="var(--bf-wange)" opacity=".75" cx="78" cy="58" r="4"/>
    </>
  ),
};

const ZUBEHOER: Record<Teil, ReactNode> = {
  ausweis: (
    <>
      <path className="bf-l" fill="none" stroke="var(--c-accent)" d="M46 70 L60 86 L74 70" style={{ stroke: 'var(--c-accent)' }}/><rect className="bf-l" fill="var(--bf-weiss)" x="53" y="84" width="14" height="16" rx="2.5"/><circle fill="var(--c-accent)" cx="60" cy="90" r="2.6"/><path stroke="var(--bf-grau)" strokeWidth="2" strokeLinecap="round" d="M56.5 96 h7"/>
    </>
  ),
  muetze: (
    <>
      <path className="bf-l" fill="var(--c-accent)" d="M38 26 Q60 2 82 26Z"/><path className="bf-l" fill="var(--c-accent)" d="M34 26 H98 Q100 30 94 31 H34Z"/>
    </>
  ),
  schal: (
    <>
      <path className="bf-l" fill="var(--bf-rot)" d="M38 68 Q60 80 82 68 L84 76 Q60 90 36 76Z"/><path className="bf-l" fill="var(--bf-rot)" d="M70 79 l8 -3 l5 18 l-9 3Z"/><path stroke="var(--bf-weiss)" strokeWidth="2" strokeLinecap="round" d="M76 92 l5 -1.5 M74.5 86 l5 -1.5"/>
    </>
  ),
  schluessel: (
    <>
      <g transform="translate(86,98) rotate(30)">
      <rect className="bf-l" fill="var(--bf-grau)" x="-3.6" y="-26" width="7.2" height="32" rx="3"/>
      <path className="bf-l" fill="var(--bf-grau)" d="M-9.5 -41 L-9.5 -30 A9.5 9.5 0 0 0 9.5 -30 L9.5 -41 L4.2 -41 L4.2 -32 A4.2 4.2 0 0 1 -4.2 -32 L-4.2 -41Z"/>
      <circle fill="var(--bf-weiss)" cx="0" cy="1.5" r="1.6"/>
      </g>
    </>
  ),
  brille: (
    <>
      <circle className="bf-l" fill="var(--bf-weiss)" fillOpacity=".35" cx="46" cy="42" r="9"/><circle className="bf-l" fill="var(--bf-weiss)" fillOpacity=".35" cx="74" cy="42" r="9"/><path className="bf-l" fill="none" d="M55 42 h10 M37 41 l-7 -3 M83 41 l7 -3"/>
    </>
  ),
  becher: (
    <>
      <path className="bf-l" fill="var(--bf-weiss)" d="M24 88 h13 l-1.6 15 h-9.8Z"/><rect className="bf-l" fill="var(--c-accent)" x="22.5" y="84.5" width="16" height="4.5" rx="2.2"/><path fill="var(--c-accent)" d="M25.6 93.5 h9.8 l-.5 4.5 h-8.8Z"/>
    </>
  ),
  guertel: (
    <>
      <path className="bf-l" fill="var(--bf-leder)" d="M38.5 99 Q60 107 81.5 99 L82.5 105 Q60 113.5 37.5 105Z"/><rect className="bf-l" fill="var(--bf-licht)" x="55.5" y="102.5" width="9" height="7.5" rx="1.5"/><rect className="bf-l" fill="var(--bf-leder)" x="68.5" y="101.5" width="8" height="9" rx="2"/>
    </>
  ),
  schuhe: (
    <>
      <path className="bf-l" fill="var(--bf-schuh)" d="M39 108 q8 -8 16 0 v7 h-16Z M65 108 q8 -8 16 0 v7 h-16Z"/><path className="bf-l" fill="var(--bf-licht)" d="M39 110.5 h6.5 v4.5 h-6.5Z M74.5 110.5 h6.5 v4.5 h-6.5Z"/>
    </>
  ),
  hut: (
    <>
      <path className="bf-l" fill="var(--bf-linie)" d="M60 4 L98 16 L60 28 L22 16Z"/><path className="bf-l" fill="var(--bf-linie)" d="M40 23 v9 q20 9 40 0 v-9"/><path className="bf-l" fill="none" stroke="var(--bf-licht)" d="M96 17 v14" style={{ stroke: 'var(--bf-licht)' }}/><circle fill="var(--bf-licht)" cx="96" cy="33" r="3.5"/>
    </>
  ),
};

/** Wo ein Teil an der jeweiligen Figur sitzt (SVG-transform); leer = wie gezeichnet. */
const LAGE: Record<Figur, Record<Teil, string>> = {
  eule: { ausweis: 'translate(0,2)', muetze: 'translate(22.8,16) scale(.62)', schal: 'translate(-18,3) scale(1.3,1)', schluessel: 'translate(8,0)', brille: 'translate(-1.2,14) scale(1.02)', becher: 'translate(-6,2)', guertel: 'translate(-3.6,0) scale(1.06,1)', schuhe: '', hut: 'translate(18,12) scale(.7)' },
  fuchs: { ausweis: 'translate(0,8)', muetze: 'translate(22.8,10) scale(.62)', schal: 'translate(0,9)', schluessel: 'translate(120,0) scale(-1,1)', brille: 'translate(-8.6,-0.2) scale(1.143,1.1)', becher: 'translate(120,3) scale(-1,1)', guertel: '', schuhe: '', hut: 'translate(18,6) scale(.7)' },
  roboter: { ausweis: 'translate(0,-1)', muetze: 'translate(6,7) scale(.6)', schal: 'translate(0,2)', schluessel: 'translate(12,-27) rotate(-15 86 98)', brille: 'translate(8.6,9) scale(.857)', becher: 'translate(-9,5)', guertel: 'translate(0,-1)', schuhe: 'translate(0,1)', hut: 'translate(4,6) scale(.62)' },
  biber: { ausweis: 'translate(0,-3)', muetze: 'translate(0,-5)', schal: '', schluessel: '', brille: '', becher: '', guertel: '', schuhe: '', hut: 'translate(0,-6)' },
  pinguin: { ausweis: 'translate(0,-6)', muetze: 'translate(0,-7)', schal: 'translate(-7.2,-4) scale(1.12,1)', schluessel: 'translate(9,6)', brille: 'translate(12,12.3) scale(.8,.85)', becher: 'translate(-9,4)', guertel: 'translate(-13.2,-10) scale(1.22,1)', schuhe: 'translate(-12,-1.5) scale(1.2,1)', hut: 'translate(0,-7)' },
};

/** Die Teile, die der Begleiter auf dieser Stufe trägt. Der Abschlusshut ersetzt die Mütze – auf dem Kopf ist nur Platz für eines. */
export function teileBis(stufe: number): Teil[] {
  const da = TEILE.slice(0, Math.max(0, Math.min(TEILE.length, stufe)));
  return da.includes('hut') ? da.filter((t) => t !== 'muetze') : da;
}

/**
 * Zeichnet eine Figur mit dem Zubehör bis zur Stufe. `neu` bekommt die Klasse „bf-neu“ (für die Animation beim Freischalten).
 * Die Figur ist Schmuck: Für Vorleseprogramme ist sie stumm, was sie sagt, steht als Text daneben.
 */
export function FigurBild({ figur, stufe, neu, groesse = 96, nurKopf = false }: { figur: Figur; stufe: number; neu?: Teil; groesse?: number; nurKopf?: boolean }) {
  const da = teileBis(stufe);
  return (
    <svg className="bf" width={groesse} height={nurKopf ? groesse : Math.round(groesse * 1.14)} viewBox={nurKopf ? '18 -8 84 84' : '0 -16 120 136'} aria-hidden="true" focusable="false">
      {KOERPER[figur]}
      {ZEICHNE.filter((t) => da.includes(t)).map((t) => (
        <g key={t} className={t === neu ? 'bf-neu' : undefined}>
          <g transform={LAGE[figur][t] || undefined}>{ZUBEHOER[t]}</g>
        </g>
      ))}
    </svg>
  );
}
