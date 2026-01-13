import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mindestanzahl interner Datenpunkte fuer eigenstaendige Bewertung
const MIN_INTERNAL_DATA_POINTS = 5;

// Bewertungsstufen (verbindlich, exklusiv)
type EvaluationLevel = 
  | "im_regionalen_rahmen"
  | "leicht_ueber_vergleich"
  | "auffaellig_hoch"
  | "auffaellig_niedrig"
  | "nicht_einordenbar";

interface EvaluationInput {
  position_id?: string;
  unit_price: number;
  unit: string;
  quantity?: number;
  beschreibung?: string;
  normalized_service_id?: string;
  normalized_material_id?: string;
  region_cluster_id?: string;
  plz?: string;
  bundesland?: string;
  service_domain: "handwerk" | "werkstatt";
}

interface StatisticsResult {
  count: number;
  q1: number | null;
  median: number | null;
  q3: number | null;
}

interface ExternalReference {
  price_min: number;
  price_max: number;
  price_median: number;
  source_name: string;
  source_type: string;
  region_type: string;
}

interface EvaluationResult {
  evaluation_level: EvaluationLevel;
  evaluation_reason: string;
  data_basis_description: string;
  uncertainty_note?: string;
  data_source: "internal" | "mixed" | "external_only" | "none";
  internal_count: number;
  external_source_name?: string;
  statistics?: {
    quartile_1: number;
    median: number;
    quartile_3: number;
  };
  deviation_percent: number | null;
}

/**
 * Bestimmt die Bewertungsstufe basierend auf statistischen Werten
 */
function determineEvaluationLevel(
  unitPrice: number,
  q1: number,
  median: number,
  q3: number
): { level: EvaluationLevel; reason: string; deviation: number } {
  
  const deviationPercent = ((unitPrice - median) / median) * 100;
  
  // Auffaellig niedrig: mehr als 25% unter Median
  if (deviationPercent <= -25) {
    return {
      level: "auffaellig_niedrig",
      reason: "Der Preis liegt deutlich unter dem regionalen Vergleichswert. Dies kann auf Qualitaetsunterschiede, eingeschraenkte Leistung oder besondere Konditionen hinweisen.",
      deviation: Math.round(deviationPercent * 10) / 10
    };
  }
  
  // Auffaellig hoch: mehr als 30% ueber Median
  if (deviationPercent >= 30) {
    return {
      level: "auffaellig_hoch",
      reason: "Der Preis liegt deutlich ueber dem regionalen Vergleichswert. Moegliche Gruende koennen besondere Qualitaet, Zusatzleistungen oder regionale Faktoren sein.",
      deviation: Math.round(deviationPercent * 10) / 10
    };
  }
  
  // Leicht ueber Vergleich: zwischen Q3 und +30%
  if (unitPrice > q3 && deviationPercent < 30) {
    return {
      level: "leicht_ueber_vergleich",
      reason: "Der Preis liegt leicht ueber dem regionalen Durchschnitt, befindet sich aber noch im erwartbaren Rahmen.",
      deviation: Math.round(deviationPercent * 10) / 10
    };
  }
  
  // Im regionalen Rahmen
  return {
    level: "im_regionalen_rahmen",
    reason: "Der Preis entspricht dem regionalen Vergleichswert.",
    deviation: Math.round(deviationPercent * 10) / 10
  };
}

/**
 * Formatiert die Datengrundlage-Beschreibung
 */
function formatDataBasis(
  internalCount: number,
  externalSource: string | null,
  bundesland: string | null | undefined,
  monthsBack: number = 12
): string {
  const parts: string[] = [];
  
  if (internalCount > 0) {
    parts.push(`${internalCount} vergleichbare Position${internalCount > 1 ? "en" : ""}`);
  }
  
  if (externalSource) {
    if (internalCount > 0) {
      parts.push(`ergaenzt durch ${externalSource}`);
    } else {
      parts.push(`Referenz: ${externalSource}`);
    }
  }
  
  if (bundesland) {
    parts.push(`Region ${bundesland}`);
  }
  
  if (internalCount > 0) {
    parts.push(`letzte ${monthsBack} Monate`);
  }
  
  return parts.join(", ") || "Keine Vergleichsdaten verfuegbar";
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const input: EvaluationInput = await req.json();
    
    console.log("Evaluate-price called with input:", JSON.stringify(input, null, 2));

    // Validierung
    if (!input.unit_price || input.unit_price <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Einheitspreis erforderlich",
          evaluation_level: "nicht_einordenbar",
          evaluation_reason: "Keine Preisangabe vorhanden.",
          data_source: "none"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Region ermitteln falls nicht angegeben
    let bundesland = input.bundesland;
    let regionClusterId = input.region_cluster_id;

    if (!bundesland && input.plz) {
      const { data: regionData } = await supabase
        .from("region_clusters")
        .select("id, bundesland")
        .eq("plz_prefix", input.plz.substring(0, 2))
        .maybeSingle();
      
      if (regionData) {
        bundesland = regionData.bundesland;
        regionClusterId = regionData.id;
      }
    }

    // 1. Interne Vergleichsdaten abfragen
    let internalStats: StatisticsResult = { count: 0, q1: null, median: null, q3: null };
    
    if (input.normalized_service_id || input.normalized_material_id) {
      let query = supabase
        .from("document_positions")
        .select("unit_price")
        .eq("comparison_eligible", true)
        .eq("normalization_status", "normalized")
        .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      if (input.normalized_service_id) {
        query = query.eq("normalized_service_id", input.normalized_service_id);
      }
      if (input.normalized_material_id) {
        query = query.eq("normalized_material_id", input.normalized_material_id);
      }
      if (input.unit) {
        query = query.eq("unit", input.unit);
      }
      if (bundesland) {
        const { data: regionIds } = await supabase
          .from("region_clusters")
          .select("id")
          .eq("bundesland", bundesland);
        
        if (regionIds && regionIds.length > 0) {
          query = query.in("region_cluster_id", regionIds.map(r => r.id));
        }
      }

      const { data: positionData, error } = await query;

      if (!error && positionData && positionData.length > 0) {
        const prices = positionData
          .map(p => p.unit_price)
          .filter((p): p is number => p !== null)
          .sort((a, b) => a - b);

        if (prices.length > 0) {
          const q1Index = Math.floor(prices.length * 0.25);
          const medianIndex = Math.floor(prices.length * 0.5);
          const q3Index = Math.floor(prices.length * 0.75);

          internalStats = {
            count: prices.length,
            q1: prices[q1Index],
            median: prices[medianIndex],
            q3: prices[q3Index]
          };
        }
      }
    }

    console.log("Internal stats:", JSON.stringify(internalStats, null, 2));

    // 2. Externe Referenzdaten bei Bedarf laden
    let externalRef: ExternalReference | null = null;

    if (internalStats.count < MIN_INTERNAL_DATA_POINTS) {
      let extQuery = supabase
        .from("external_reference_data")
        .select("*")
        .eq("service_domain", input.service_domain)
        .eq("is_active", true)
        .gte("valid_until", new Date().toISOString().split("T")[0]);

      if (input.normalized_service_id) {
        extQuery = extQuery.eq("normalized_service_id", input.normalized_service_id);
      }
      if (input.normalized_material_id) {
        extQuery = extQuery.eq("normalized_material_id", input.normalized_material_id);
      }
      if (input.unit) {
        extQuery = extQuery.eq("unit", input.unit);
      }

      if (bundesland) {
        extQuery = extQuery.or(`bundesland.eq.${bundesland},region_type.eq.bundesweit`);
      }

      const { data: extData } = await extQuery.order("source_date", { ascending: false }).limit(1);

      if (extData && extData.length > 0) {
        const ext = extData[0];
        externalRef = {
          price_min: ext.price_min,
          price_max: ext.price_max,
          price_median: ext.price_median,
          source_name: ext.source_name,
          source_type: ext.source_type,
          region_type: ext.region_type
        };
      }
    }

    console.log("External reference:", JSON.stringify(externalRef, null, 2));

    // 3. Bewertung durchfuehren
    let result: EvaluationResult;

    // Fall A: Genuegend interne Daten
    if (internalStats.count >= MIN_INTERNAL_DATA_POINTS && 
        internalStats.q1 !== null && 
        internalStats.median !== null && 
        internalStats.q3 !== null) {
      
      const evaluation = determineEvaluationLevel(
        input.unit_price,
        internalStats.q1,
        internalStats.median,
        internalStats.q3
      );

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(internalStats.count, null, bundesland),
        data_source: "internal",
        internal_count: internalStats.count,
        statistics: {
          quartile_1: internalStats.q1,
          median: internalStats.median,
          quartile_3: internalStats.q3
        },
        deviation_percent: evaluation.deviation
      };
    }
    // Fall B: Gemischte Daten (wenige interne + externe Referenz)
    else if (internalStats.count > 0 && externalRef) {
      const combinedMedian = internalStats.median !== null 
        ? (internalStats.median + externalRef.price_median) / 2
        : externalRef.price_median;
      const combinedQ1 = internalStats.q1 !== null
        ? (internalStats.q1 + externalRef.price_min) / 2
        : externalRef.price_min;
      const combinedQ3 = internalStats.q3 !== null
        ? (internalStats.q3 + externalRef.price_max) / 2
        : externalRef.price_max;

      const evaluation = determineEvaluationLevel(
        input.unit_price,
        combinedQ1,
        combinedMedian,
        combinedQ3
      );

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(
          internalStats.count, 
          externalRef.source_name, 
          bundesland
        ),
        uncertainty_note: "Die Einordnung basiert auf begrenzten internen Vergleichsdaten und ergaenzenden externen Branchenreferenzen. Mit wachsender Datenbasis wird die Bewertung weiter praezisiert.",
        data_source: "mixed",
        internal_count: internalStats.count,
        external_source_name: externalRef.source_name,
        statistics: {
          quartile_1: combinedQ1,
          median: combinedMedian,
          quartile_3: combinedQ3
        },
        deviation_percent: evaluation.deviation
      };
    }
    // Fall C: Nur externe Referenz
    else if (externalRef) {
      const evaluation = determineEvaluationLevel(
        input.unit_price,
        externalRef.price_min,
        externalRef.price_median,
        externalRef.price_max
      );

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(0, externalRef.source_name, bundesland),
        uncertainty_note: "Die Einordnung basiert ausschliesslich auf externen Branchenreferenzen. Fuer eine praezisere Bewertung werden interne Vergleichsdaten benoetigt.",
        data_source: "external_only",
        internal_count: 0,
        external_source_name: externalRef.source_name,
        statistics: {
          quartile_1: externalRef.price_min,
          median: externalRef.price_median,
          quartile_3: externalRef.price_max
        },
        deviation_percent: evaluation.deviation
      };
    }
    // Fall D: Keine Daten verfuegbar
    else {
      result = {
        evaluation_level: "nicht_einordenbar",
        evaluation_reason: "Fuer diese Leistung liegen derzeit keine ausreichenden Vergleichsdaten vor. Eine Preiseinordnung ist daher nicht moeglich.",
        data_basis_description: "Keine Vergleichsdaten verfuegbar",
        uncertainty_note: "Es liegen weder interne Vergleichsdaten noch externe Branchenreferenzen fuer diese Leistung vor.",
        data_source: "none",
        internal_count: 0,
        deviation_percent: null
      };
    }

    console.log("Evaluation result:", JSON.stringify(result, null, 2));

    // 4. Ergebnis speichern (optional, wenn position_id angegeben)
    if (input.position_id) {
      const { error: saveError } = await supabase
        .from("price_evaluations")
        .insert({
          position_id: input.position_id,
          data_source: result.data_source,
          internal_comparison_count: result.internal_count,
          external_reference_used: result.data_source === "mixed" || result.data_source === "external_only",
          external_source_name: result.external_source_name,
          quartile_1: result.statistics?.quartile_1,
          median: result.statistics?.median,
          quartile_3: result.statistics?.quartile_3,
          evaluation_level: result.evaluation_level,
          evaluation_reason: result.evaluation_reason,
          data_basis_description: result.data_basis_description,
          uncertainty_note: result.uncertainty_note,
          deviation_percent: result.deviation_percent,
          region_cluster_id: regionClusterId,
          normalized_service_id: input.normalized_service_id,
          normalized_material_id: input.normalized_material_id
        });

      if (saveError) {
        console.error("Error saving evaluation:", saveError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in evaluate-price:", error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        evaluation_level: "nicht_einordenbar",
        evaluation_reason: "Ein technischer Fehler ist aufgetreten.",
        data_source: "none"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
