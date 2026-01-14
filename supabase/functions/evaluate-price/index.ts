import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schwellenwerte für Gewichtungslogik
const THRESHOLDS = {
  EXTERNAL_ONLY: 2,      // 0-2: 80-100% extern
  LOW_INTERNAL: 9,       // 3-9: 70-80% extern
  MEDIUM_INTERNAL: 29,   // 10-29: 20-40% extern
  HIGH_INTERNAL: 30,     // ≥30: 0% extern
  FULL_CONFIDENCE: 100,  // ≥100: volle Konfidenz
};

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
  stddev?: number | null;
}

interface ExternalReference {
  price_min: number;
  price_max: number;
  price_median: number;
  source_name: string;
  source_type: string;
  region_type: string;
}

// Interne Daten für Analytics/Reporting (nicht für Kunden sichtbar)
interface InternalMetrics {
  confidence_score: number;
  internal_weight: number;
  external_weight: number;
  data_consistency: number;
  evaluation_mode: "internal_only" | "weighted_mixed" | "external_fallback" | "no_data";
}

// Öffentliche Confidence-Info für Kunden
interface PublicConfidence {
  level: "hoch" | "mittel" | "eingeschraenkt";
  reason: string;
  samples: number;
}

interface EvaluationResult {
  evaluation_level: EvaluationLevel;
  evaluation_reason: string;
  data_basis_description: string;
  data_source: "internal" | "mixed" | "external_only" | "none";
  internal_count: number;
  external_source_name?: string;
  statistics?: {
    quartile_1: number;
    median: number;
    quartile_3: number;
  };
  deviation_percent: number | null;
  // NEU: Öffentliche Confidence für Kunden
  confidence: PublicConfidence;
  // Interne Metriken (nur für Backend/Analytics)
  _internal_metrics?: InternalMetrics;
}

/**
 * Berechnet Confidence Score basierend auf Datenlage (0-100)
 * Nur für interne Nutzung, nicht für Kunden sichtbar
 */
function calculateConfidenceScore(
  internalCount: number,
  dataConsistency: number = 1.0,
  externalUsed: boolean = false
): number {
  let baseScore: number;
  
  if (internalCount >= 100) {
    baseScore = 95 + Math.min(5, (internalCount - 100) / 20);
  } else if (internalCount >= 30) {
    baseScore = 75 + ((internalCount - 30) / 70) * 20;
  } else if (internalCount >= 10) {
    baseScore = 50 + ((internalCount - 10) / 20) * 25;
  } else if (internalCount >= 3) {
    baseScore = 30 + ((internalCount - 3) / 7) * 20;
  } else {
    baseScore = internalCount * 10;
  }

  // Konsistenz-Faktor (Standardabweichung der Datenpunkte)
  const consistencyMultiplier = Math.max(0.7, Math.min(1.0, dataConsistency));
  
  // Externe Daten reduzieren Confidence leicht
  const externalPenalty = externalUsed ? 0.9 : 1.0;

  return Math.round(baseScore * consistencyMultiplier * externalPenalty);
}

/**
 * Erzeugt kundenfreundliche Confidence-Info
 */
function createPublicConfidence(internalCount: number, confidenceScore: number): PublicConfidence {
  if (confidenceScore >= 75 && internalCount >= 30) {
    return {
      level: "hoch",
      reason: `Basierend auf ${internalCount} vergleichbaren Angeboten`,
      samples: internalCount
    };
  } else if (confidenceScore >= 50 || internalCount >= 10) {
    return {
      level: "mittel",
      reason: "Regionale Vergleichsdaten verfügbar",
      samples: internalCount
    };
  } else {
    return {
      level: "eingeschraenkt",
      reason: "Begrenzte Vergleichsdaten für diese Position",
      samples: internalCount
    };
  }
}

/**
 * Berechnet Gewichtung zwischen internen und externen Daten
 */
function calculateWeights(internalCount: number): { internal: number; external: number } {
  if (internalCount >= THRESHOLDS.HIGH_INTERNAL) {
    return { internal: 1.0, external: 0.0 };
  } else if (internalCount >= 10) {
    // 10-29: 60-80% intern
    const ratio = (internalCount - 10) / 20;
    return { internal: 0.6 + ratio * 0.2, external: 0.4 - ratio * 0.2 };
  } else if (internalCount >= 3) {
    // 3-9: 20-30% intern
    const ratio = (internalCount - 3) / 7;
    return { internal: 0.2 + ratio * 0.1, external: 0.8 - ratio * 0.1 };
  } else {
    // 0-2: 0-20% intern
    return { internal: internalCount * 0.1, external: 1.0 - internalCount * 0.1 };
  }
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
  
  // Auffällig niedrig: mehr als 25% unter Median
  if (deviationPercent <= -25) {
    return {
      level: "auffaellig_niedrig",
      reason: "Der Preis liegt deutlich unter dem regionalen Vergleichswert.",
      deviation: Math.round(deviationPercent * 10) / 10
    };
  }
  
  // Auffällig hoch: mehr als 30% über Median
  if (deviationPercent >= 30) {
    return {
      level: "auffaellig_hoch",
      reason: "Der Preis liegt deutlich über dem regionalen Vergleichswert.",
      deviation: Math.round(deviationPercent * 10) / 10
    };
  }
  
  // Leicht über Vergleich: zwischen Q3 und +30%
  if (unitPrice > q3 && deviationPercent < 30) {
    return {
      level: "leicht_ueber_vergleich",
      reason: "Der Preis liegt leicht über dem regionalen Durchschnitt.",
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
 * Formatiert die Datengrundlage-Beschreibung (professionell, ohne Unsicherheitshinweise)
 */
function formatDataBasis(
  internalCount: number,
  bundesland: string | null | undefined
): string {
  const parts: string[] = [];
  
  // Immer professionelle Formulierung, keine Hinweise auf geringe Datenbasis
  parts.push("Vergleichsdaten");
  
  if (bundesland) {
    parts.push(`Region ${bundesland}`);
  } else {
    parts.push("bundesweit");
  }
  
  parts.push("letzte 12 Monate");
  
  return parts.join(", ");
}

/**
 * Kombiniert interne und externe Statistiken mit Gewichtung
 */
function combineStatistics(
  internalStats: StatisticsResult,
  externalRef: ExternalReference | null,
  weights: { internal: number; external: number }
): { q1: number; median: number; q3: number } {
  
  if (!externalRef || weights.external === 0) {
    return {
      q1: internalStats.q1!,
      median: internalStats.median!,
      q3: internalStats.q3!
    };
  }
  
  if (internalStats.count === 0 || weights.internal === 0) {
    return {
      q1: externalRef.price_min,
      median: externalRef.price_median,
      q3: externalRef.price_max
    };
  }
  
  // Gewichtete Kombination
  return {
    q1: internalStats.q1! * weights.internal + externalRef.price_min * weights.external,
    median: internalStats.median! * weights.internal + externalRef.price_median * weights.external,
    q3: internalStats.q3! * weights.internal + externalRef.price_max * weights.external
  };
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
          evaluation_reason: "Die Position wurde auf Basis aktuell verfügbarer Vergleichsdaten eingeordnet.",
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

    // 1. Interne Vergleichsdaten abfragen (nur letzte 12 Monate)
    let internalStats: StatisticsResult = { count: 0, q1: null, median: null, q3: null, stddev: null };
    
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
          
          // Berechne Standardabweichung für Konsistenz-Score
          const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
          const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
          const stddev = Math.sqrt(variance);
          const coefficientOfVariation = mean > 0 ? stddev / mean : 1;

          internalStats = {
            count: prices.length,
            q1: prices[q1Index],
            median: prices[medianIndex],
            q3: prices[q3Index],
            stddev: coefficientOfVariation
          };
        }
      }
    }

    console.log("Internal stats:", JSON.stringify(internalStats, null, 2));

    // 2. Externe Referenzdaten laden wenn nötig (silent fallback)
    let externalRef: ExternalReference | null = null;
    const weights = calculateWeights(internalStats.count);

    if (weights.external > 0) {
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
    console.log("Weights:", JSON.stringify(weights, null, 2));

    // 3. Bewertung durchführen
    let result: EvaluationResult;
    const dataConsistency = internalStats.stddev ? Math.max(0, 1 - internalStats.stddev) : 0.8;

    // Bestimme Evaluierungsmodus
    let evaluationMode: InternalMetrics["evaluation_mode"];
    if (internalStats.count >= THRESHOLDS.HIGH_INTERNAL) {
      evaluationMode = "internal_only";
    } else if (internalStats.count > 0 && externalRef) {
      evaluationMode = "weighted_mixed";
    } else if (externalRef) {
      evaluationMode = "external_fallback";
    } else {
      evaluationMode = "no_data";
    }

    // Fall A: Genügend interne Daten (≥30) - 100% intern
    if (internalStats.count >= THRESHOLDS.HIGH_INTERNAL && 
        internalStats.q1 !== null && 
        internalStats.median !== null && 
        internalStats.q3 !== null) {
      
      const evaluation = determineEvaluationLevel(
        input.unit_price,
        internalStats.q1,
        internalStats.median,
        internalStats.q3
      );

      const confidenceScore = calculateConfidenceScore(internalStats.count, dataConsistency, false);

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(internalStats.count, bundesland),
        data_source: "internal",
        internal_count: internalStats.count,
        statistics: {
          quartile_1: internalStats.q1,
          median: internalStats.median,
          quartile_3: internalStats.q3
        },
        deviation_percent: evaluation.deviation,
        confidence: createPublicConfidence(internalStats.count, confidenceScore),
        _internal_metrics: {
          confidence_score: confidenceScore,
          internal_weight: 1.0,
          external_weight: 0.0,
          data_consistency: dataConsistency,
          evaluation_mode: "internal_only"
        }
      };
    }
    // Fall B: Gewichtete Mischung (interne + externe Daten)
    else if (internalStats.count > 0 && externalRef) {
      const combinedStats = combineStatistics(internalStats, externalRef, weights);
      
      const evaluation = determineEvaluationLevel(
        input.unit_price,
        combinedStats.q1,
        combinedStats.median,
        combinedStats.q3
      );

      const confidenceScore = calculateConfidenceScore(internalStats.count, dataConsistency, true);

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(internalStats.count, bundesland),
        data_source: "mixed",
        internal_count: internalStats.count,
        statistics: {
          quartile_1: combinedStats.q1,
          median: combinedStats.median,
          quartile_3: combinedStats.q3
        },
        deviation_percent: evaluation.deviation,
        confidence: createPublicConfidence(internalStats.count, confidenceScore),
        _internal_metrics: {
          confidence_score: confidenceScore,
          internal_weight: weights.internal,
          external_weight: weights.external,
          data_consistency: dataConsistency,
          evaluation_mode: "weighted_mixed"
        }
      };
    }
    // Fall C: Nur externe Referenz (silent fallback)
    else if (externalRef) {
      const evaluation = determineEvaluationLevel(
        input.unit_price,
        externalRef.price_min,
        externalRef.price_median,
        externalRef.price_max
      );

      const confidenceScore = calculateConfidenceScore(0, 0.7, true);

      result = {
        evaluation_level: evaluation.level,
        evaluation_reason: evaluation.reason,
        data_basis_description: formatDataBasis(0, bundesland),
        data_source: "external_only",
        internal_count: 0,
        statistics: {
          quartile_1: externalRef.price_min,
          median: externalRef.price_median,
          quartile_3: externalRef.price_max
        },
        deviation_percent: evaluation.deviation,
        confidence: createPublicConfidence(0, confidenceScore),
        _internal_metrics: {
          confidence_score: confidenceScore,
          internal_weight: 0.0,
          external_weight: 1.0,
          data_consistency: 0.7,
          evaluation_mode: "external_fallback"
        }
      };
    }
    // Fall D: Keine Daten - aber trotzdem professionelle Antwort
    else {
      result = {
        evaluation_level: "nicht_einordenbar",
        evaluation_reason: "Die Position wurde auf Basis aktuell verfügbarer Vergleichsdaten eingeordnet.",
        data_basis_description: formatDataBasis(0, bundesland),
        data_source: "none",
        internal_count: 0,
        deviation_percent: null,
        confidence: createPublicConfidence(0, 0),
        _internal_metrics: {
          confidence_score: 0,
          internal_weight: 0.0,
          external_weight: 0.0,
          data_consistency: 0,
          evaluation_mode: "no_data"
        }
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
          external_source_name: externalRef?.source_name,
          quartile_1: result.statistics?.quartile_1,
          median: result.statistics?.median,
          quartile_3: result.statistics?.quartile_3,
          evaluation_level: result.evaluation_level,
          evaluation_reason: result.evaluation_reason,
          data_basis_description: result.data_basis_description,
          // Keine uncertainty_note mehr speichern
          uncertainty_note: null,
          deviation_percent: result.deviation_percent,
          region_cluster_id: regionClusterId,
          normalized_service_id: input.normalized_service_id,
          normalized_material_id: input.normalized_material_id
        });

      if (saveError) {
        console.error("Error saving evaluation:", saveError);
      }
    }

    // Entferne interne Metriken aus der Kunden-Response
    const customerResult = { ...result };
    delete customerResult._internal_metrics;
    delete customerResult.external_source_name;

    return new Response(
      JSON.stringify(customerResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in evaluate-price:", error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        evaluation_level: "nicht_einordenbar",
        evaluation_reason: "Die Position wurde auf Basis aktuell verfügbarer Vergleichsdaten eingeordnet.",
        data_source: "none"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
