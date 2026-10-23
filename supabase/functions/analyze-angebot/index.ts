// analyze-angebot v4 – 3 Schritte: LESEN (KI) → PRÜFEN (Code) → VERGLEICH (KI-Spannbreite) → Ampel (Code)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { classify, begruendung, type Stufe } from './classify.ts';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const TOTAL_BUDGET_MS = 44_000;
const MODEL_LESEN = 'google/gemini-3.8-flash';
const MODEL_LESEN_FALLBACK = 'google/gemini-3.1-flash-lite';
const MODEL_VERGLEICH = 'google/gemini-3.8-flash';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

class AiError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

async function callTool(opts: {
  apiKey: string; model: string; system: string; userContent: unknown;
  tool: { name: string; description: string; parameters: unknown }; timeoutMs: number;
}): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, opts.timeoutMs));
  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.userContent },
        ],
        tools: [{ type: 'function', function: opts.tool }],
        tool_choice: { type: 'function', function: { name: opts.tool.name } },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[analyze-angebot] AI ${opts.model} ${res.status}:`, text.slice(0, 300));
      if (res.status === 429) throw new AiError('Zu viele Anfragen. Bitte in einem Moment erneut versuchen.', 429);
      if (res.status === 402) throw new AiError('KI-Guthaben aufgebraucht. Bitte Guthaben aufladen.', 402);
      throw new AiError('KI-Analyse fehlgeschlagen');
    }
    if (!text) throw new AiError('Leere KI-Antwort');
    const data = JSON.parse(text);
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new AiError('KI hat keine strukturierte Antwort geliefert');
    return typeof args === 'string' ? JSON.parse(args) : args;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Schritt 1: LESEN ----------
const LESEN_SYSTEM = `Du bist ein exakter Erfassungs-Assistent für deutsche Handwerker-Angebote und -Rechnungen.
Deine EINZIGE Aufgabe: Positionen so abschreiben, wie sie im Dokument stehen. Du bewertest NICHTS.

Regeln:
- Erfasse jede Leistungsposition genau EINMAL, in der Reihenfolge des Dokuments.
- Eine Position hat einen eigenen Preis (Einzelpreis und/oder Gesamtpreis). Langtexte/Erläuterungen ohne eigenen Preis gehören zur Beschreibung der darüberstehenden Position – nicht als eigene Position.
- KEINE Zwischensummen, Überträge, Titelsummen, Netto/Brutto/MwSt-Zeilen, Rabatt-Summen, Bankdaten, AGB.
- Zahlen exakt übernehmen (deutsches Format "1.234,56" → 1234.56). Fehlt ein Wert im Dokument, setze null. NIEMALS Werte erfinden oder errechnen.
- "beschreibung": kurzer Leistungstext (max. ~150 Zeichen), wörtlich aus dem Dokument.
- "einheit" wie im Dokument (m², m, Stk, Std, psch, ...). "ist_pauschal" = true bei psch/pauschal/1 Pauschale.
- Bei Bedarfs-/Alternativ-/Eventualpositionen (ohne Gesamtbetrag in der Summe): "ist_optional" = true.
- Gewerk kurz benennen (z. B. Zimmerei, Maler, Sanitär, Elektro, Bodenleger).`;

const LESEN_TOOL = {
  name: 'angebot_erfassen',
  description: 'Erfasst Kopf- und Positionsdaten des Dokuments exakt wie abgedruckt.',
  parameters: {
    type: 'object',
    properties: {
      ist_handwerker_dokument: { type: 'boolean' },
      handwerker_firma: { type: ['string', 'null'] },
      gewerk: { type: ['string', 'null'] },
      summe_netto: { type: ['number', 'null'] },
      summe_brutto: { type: ['number', 'null'] },
      positionen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position_nummer: { type: ['string', 'null'] },
            beschreibung: { type: 'string' },
            menge: { type: ['number', 'null'] },
            einheit: { type: ['string', 'null'] },
            einzelpreis: { type: ['number', 'null'] },
            gesamtpreis: { type: ['number', 'null'] },
            ist_pauschal: { type: 'boolean' },
            ist_optional: { type: 'boolean' },
          },
          required: ['beschreibung', 'menge', 'einheit', 'einzelpreis', 'gesamtpreis', 'ist_pauschal', 'ist_optional'],
        },
      },
    },
    required: ['ist_handwerker_dokument', 'handwerker_firma', 'gewerk', 'summe_netto', 'summe_brutto', 'positionen'],
  },
};

// ---------- Schritt 2: PRÜFEN ----------
const SUMMEN_BEGRIFFE = ['übertrag', 'zwischensumme', 'nettobetrag', 'bruttobetrag', 'gesamtsumme', 'mwst', 'mehrwertsteuer', 'umsatzsteuer', 'summe netto', 'summe brutto', 'titelsumme', 'endbetrag'];

interface RawPos {
  position_nummer: string | null; beschreibung: string; menge: number | null; einheit: string | null;
  einzelpreis: number | null; gesamtpreis: number | null; ist_pauschal: boolean; ist_optional: boolean;
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export function pruefen(raw: RawPos[], summeNetto: number | null, summeBrutto: number | null) {
  const hinweise: string[] = [];
  const seen = new Set<string>();
  let duplikate = 0, summenzeilen = 0, rechenfehler = 0;

  const positionen = raw
    .map((p) => ({
      ...p,
      beschreibung: String(p.beschreibung || '').trim(),
      menge: num(p.menge), einzelpreis: num(p.einzelpreis), gesamtpreis: num(p.gesamtpreis),
    }))
    .filter((p) => {
      const d = p.beschreibung.toLowerCase();
      if (!d) return false;
      if (SUMMEN_BEGRIFFE.some((t) => d.startsWith(t) || (d.includes(t) && d.length < 40))) { summenzeilen++; return false; }
      const key = `${p.position_nummer ?? ''}|${d.replace(/\s+/g, ' ').slice(0, 80)}|${p.gesamtpreis ?? p.einzelpreis ?? ''}`;
      if (seen.has(key)) { duplikate++; return false; }
      seen.add(key);
      return true;
    })
    .map((p) => {
      let rechnung_ok: boolean | null = null;
      if (p.menge != null && p.einzelpreis != null && p.gesamtpreis != null && p.gesamtpreis > 0) {
        const diff = Math.abs(p.menge * p.einzelpreis - p.gesamtpreis) / p.gesamtpreis;
        rechnung_ok = diff <= 0.02;
        if (!rechnung_ok) rechenfehler++;
      }
      // Vergleichspreis je Einheit – nur aus Dokumentwerten abgeleitet, nie erfunden
      let vergleichspreis: number | null = p.einzelpreis;
      if (vergleichspreis == null && p.gesamtpreis != null) {
        vergleichspreis = p.menge && p.menge > 0 ? p.gesamtpreis / p.menge : p.gesamtpreis;
      }
      return { ...p, rechnung_ok, vergleichspreis };
    });

  if (duplikate) hinweise.push(`${duplikate} doppelt erkannte Position(en) wurden zusammengeführt.`);
  if (rechenfehler) hinweise.push(`Bei ${rechenfehler} Position(en) passt Menge × Einzelpreis nicht zum Gesamtpreis.`);

  const summePositionen = positionen
    .filter((p) => !p.ist_optional)
    .reduce((s, p) => s + (p.gesamtpreis ?? (p.menge != null && p.einzelpreis != null ? p.menge * p.einzelpreis : 0)), 0);

  let summe_passt: boolean | null = null;
  const ref = summeNetto ?? (summeBrutto != null ? summeBrutto / 1.19 : null);
  if (ref != null && ref > 0 && summePositionen > 0) {
    summe_passt = Math.abs(summePositionen - ref) / ref <= 0.05;
    if (!summe_passt) {
      hinweise.push('Die Summe der erkannten Positionen weicht vom Gesamtbetrag des Dokuments ab – möglicherweise wurden nicht alle Positionen vollständig gelesen (z. B. Rabatte oder Nachlässe).');
    }
  }

  return {
    positionen,
    validierung: {
      summe_positionen_netto: Math.round(summePositionen * 100) / 100,
      summe_dokument_netto: ref != null ? Math.round(ref * 100) / 100 : null,
      summe_passt, duplikate_entfernt: duplikate, summenzeilen_entfernt: summenzeilen, rechenfehler, hinweise,
    },
  };
}

// ---------- Schritt 3: VERGLEICH ----------
const VERGLEICH_SYSTEM = `Du kennst übliche Netto-Preise für Handwerkerleistungen in Deutschland (2024–2026).
Gib für JEDE Position eine realistische Netto-Spannbreite (min/max) an, die vergleichbare Betriebe in der Region typischerweise verlangen.
- Die Spannbreite muss sich auf DIESELBE Bezugsbasis beziehen wie "vergleichspreis" (je angegebener Einheit; bei Pauschalen für die gesamte Leistung).
- Inkl. üblicher Material- und Lohnanteile, wenn die Beschreibung "liefern und montieren" o. ä. nahelegt.
- Realistisch und eher breit statt erfunden präzise. Keine Bewertung, keine Texte – nur Zahlen.
- "sicherheit": "hoch" bei Standardleistungen, "mittel" bei üblichen, "eingeschraenkt" bei unklaren/sehr individuellen Leistungen.`;

const VERGLEICH_TOOL = {
  name: 'spannbreiten',
  description: 'Regionale Netto-Preisspannbreiten je Position.',
  parameters: {
    type: 'object',
    properties: {
      werte: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer' },
            preis_min: { type: ['number', 'null'] },
            preis_max: { type: ['number', 'null'] },
            sicherheit: { type: 'string', enum: ['hoch', 'mittel', 'eingeschraenkt'] },
          },
          required: ['index', 'preis_min', 'preis_max', 'sicherheit'],
        },
      },
    },
    required: ['werte'],
  },
};

function regionHinweis(plz?: string): string {
  if (!plz || plz.length < 2) return 'Deutschland (keine Region angegeben)';
  return `PLZ-Region ${plz.slice(0, 2)}xxx`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const start = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - start);

  try {
    const body = await req.json().catch(() => null);
    const fileBase64: unknown = body?.fileBase64;
    const plz: string | undefined = typeof body?.plz === 'string' ? body.plz.replace(/\D/g, '').slice(0, 5) : undefined;
    if (typeof fileBase64 !== 'string' || fileBase64.length < 100) {
      return json({ success: false, error: 'Keine Datei übermittelt' }, 400);
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ success: false, error: 'API-Konfigurationsfehler' }, 500);

    const m = fileBase64.match(/^data:([^;]+);base64,(.+)$/s);
    const mime = (m ? m[1] : 'application/pdf').toLowerCase();
    const b64 = m ? m[2] : fileBase64;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(mime)) {
      return json({ success: false, error: 'Dateiformat nicht unterstützt. Bitte PDF, JPG, PNG oder WEBP hochladen.' }, 400);
    }
    const dataUrl = `data:${mime === 'image/jpg' ? 'image/jpeg' : mime};base64,${b64}`;
    console.log(`[analyze-angebot] v4 start mime=${mime} size=${b64.length}`);

    // Schritt 1
    const lesenContent = [
      { type: 'text', text: 'Erfasse alle Positionen dieses Dokuments exakt.' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ];
    let erfasst: any;
    try {
      erfasst = await callTool({ apiKey, model: MODEL_LESEN, system: LESEN_SYSTEM, userContent: lesenContent, tool: LESEN_TOOL, timeoutMs: 26_000 });
    } catch (e) {
      if (e instanceof AiError && (e.status === 429 || e.status === 402)) throw e;
      console.warn('[analyze-angebot] Lesen mit Pro fehlgeschlagen, Fallback Flash:', (e as Error).message);
      erfasst = await callTool({ apiKey, model: MODEL_LESEN_FALLBACK, system: LESEN_SYSTEM, userContent: lesenContent, tool: LESEN_TOOL, timeoutMs: remaining() - 8_000 });
    }
    console.log(`[analyze-angebot] Lesen fertig nach ${Date.now() - start}ms, roh=${erfasst?.positionen?.length ?? 0}`);

    if (erfasst?.ist_handwerker_dokument === false && !(erfasst?.positionen?.length)) {
      return json({ success: false, error: 'Das Dokument scheint kein Handwerker-Angebot bzw. keine Handwerker-Rechnung zu sein.' }, 422);
    }

    // Schritt 2
    const { positionen, validierung } = pruefen(erfasst?.positionen || [], num(erfasst?.summe_netto), num(erfasst?.summe_brutto));
    if (positionen.length === 0) {
      return json({ success: false, error: 'Im Dokument konnten keine Positionen mit Preisen erkannt werden.' }, 422);
    }

    // Schritt 3
    const region = regionHinweis(plz);
    const bewertbar = positionen.map((p, i) => ({ p, i })).filter(({ p }) => p.vergleichspreis != null);
    const spannen = new Map<number, { min: number | null; max: number | null; sicherheit: string }>();
    let datenbasis = `KI-gestützte Einschätzung regionaler Vergleichswerte (${region})`;
    if (bewertbar.length > 0) {
      try {
        const liste = bewertbar.map(({ p, i }) => ({
          index: i, beschreibung: p.beschreibung, menge: p.menge, einheit: p.einheit,
          vergleichspreis_bezug: p.ist_pauschal || p.einzelpreis == null && !p.menge ? 'gesamte Leistung (pauschal)' : `je ${p.einheit || 'Einheit'}`,
        }));
        const res = await callTool({
          apiKey, model: MODEL_VERGLEICH, system: VERGLEICH_SYSTEM, tool: VERGLEICH_TOOL,
          timeoutMs: remaining() - 1_500,
          userContent: `Gewerk: ${erfasst?.gewerk || 'Handwerk'}\nRegion: ${region}\nPositionen (JSON):\n${JSON.stringify(liste)}`,
        });
        for (const w of res?.werte || []) {
          if (typeof w?.index === 'number') spannen.set(w.index, { min: num(w.preis_min), max: num(w.preis_max), sicherheit: w.sicherheit || 'mittel' });
        }
      } catch (e) {
        if (e instanceof AiError && (e.status === 429 || e.status === 402)) throw e;
        console.error('[analyze-angebot] Vergleich fehlgeschlagen:', (e as Error).message);
        datenbasis = 'Vergleichswerte konnten nicht rechtzeitig ermittelt werden';
      }
    }

    // Ampel (Code)
    const statistik: Record<Stufe, number> = { im_regionalen_rahmen: 0, leicht_ueber_vergleich: 0, auffaellig_hoch: 0, auffaellig_niedrig: 0, nicht_einordenbar: 0 };
    const ergebnis = positionen.map((p, i) => {
      const s = spannen.get(i);
      const min = s?.min ?? null, max = s?.max ?? null;
      const { stufe, abweichung_prozent } = classify({ vergleichspreis: p.vergleichspreis, min, max });
      statistik[stufe]++;
      const einheitText = p.ist_pauschal ? 'Pauschale' : p.einheit;
      const hinweise: string[] = [];
      if (p.rechnung_ok === false) hinweise.push('Menge × Einzelpreis ergibt nicht den angegebenen Gesamtpreis.');
      if (p.ist_optional) hinweise.push('Bedarfs-/Alternativposition.');
      if (s?.sicherheit === 'eingeschraenkt') hinweise.push('Eingeschränkte Vergleichbarkeit wegen individueller Leistung.');
      return {
        position_nummer: p.position_nummer || String(i + 1),
        beschreibung: p.beschreibung,
        menge: p.menge, einheit: p.einheit,
        einzelpreis: p.einzelpreis, gesamtpreis: p.gesamtpreis,
        vergleichspreis: p.vergleichspreis != null ? Math.round(p.vergleichspreis * 100) / 100 : null,
        ist_pauschal: p.ist_pauschal, ist_optional: p.ist_optional,
        einordnung_stufe: stufe,
        abweichung_prozent,
        marktpreis_min: min, marktpreis_max: max,
        einordnung_begruendung: begruendung(stufe, min, max, einheitText, datenbasis),
        hinweis: hinweise.join(' ') || undefined,
        datengrundlage: datenbasis,
        datenquelle: 'KI-Einschätzung',
        confidence: s ? { level: s.sicherheit, reason: s.sicherheit === 'hoch' ? 'Standardleistung, gut vergleichbar' : s.sicherheit === 'mittel' ? 'Übliche Leistung, mittlere Vergleichbarkeit' : 'Individuelle Leistung, eingeschränkt vergleichbar', samples: 0 } : undefined,
      };
    });

    const n = ergebnis.length;
    const auff = statistik.auffaellig_hoch + statistik.auffaellig_niedrig;
    const summary = `${n} Position${n !== 1 ? 'en' : ''} erkannt. Im regionalen Vergleich: ${statistik.im_regionalen_rahmen} innerhalb der beobachteten Spannbreite, ${statistik.leicht_ueber_vergleich} leicht darüber, ${auff} auffällig${statistik.nicht_einordenbar ? `, ${statistik.nicht_einordenbar} nicht einordenbar` : ''}. Die Einordnung ist indikativ.`;
    const plausibility_score = n ? Math.round(((statistik.im_regionalen_rahmen + statistik.leicht_ueber_vergleich * 0.5) / n) * 100) : null;

    console.log(`[analyze-angebot] fertig nach ${Date.now() - start}ms`, statistik, validierung.hinweise);
    return json({
      success: true,
      analysis: {
        handwerker_firma: erfasst?.handwerker_firma || null,
        gewerk: erfasst?.gewerk || null,
        service_domain: 'handwerk',
        gesamtpreis: num(erfasst?.summe_brutto) ?? num(erfasst?.summe_netto) ?? validierung.summe_positionen_netto,
        positionen: ergebnis,
        analysis_summary: summary,
        plausibility_score,
        statistik,
        validierung,
      },
      processing_time_ms: Date.now() - start,
    });
  } catch (error) {
    const status = error instanceof AiError ? error.status : 500;
    const msg = error instanceof Error && error.name === 'AbortError'
      ? 'Die Analyse hat zu lange gedauert. Bitte erneut versuchen.'
      : error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[analyze-angebot] Fehler:', msg);
    return json({ success: false, error: msg, processing_time_ms: Date.now() - start }, status);
  }
});
