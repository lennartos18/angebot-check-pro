import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ArrowLeft,
  Download,
  Loader2,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

// Neue Bewertungsstufen
type EvaluationLevel = 
  | "im_regionalen_rahmen"
  | "leicht_ueber_vergleich"
  | "auffaellig_hoch"
  | "auffaellig_niedrig"
  | "nicht_einordenbar";

// Legacy-Status fuer Rueckwaertskompatibilitaet
type LegacyStatus = "green" | "yellow" | "red";
type StatusType = LegacyStatus | EvaluationLevel;

const toStatusType = (status: string | null): StatusType => {
  const validStatuses: StatusType[] = [
    "green", "yellow", "red",
    "im_regionalen_rahmen", "leicht_ueber_vergleich",
    "auffaellig_hoch", "auffaellig_niedrig", "nicht_einordenbar"
  ];
  if (status && validStatuses.includes(status as StatusType)) {
    return status as StatusType;
  }
  return "nicht_einordenbar";
};

// Mapping von Bewertungsstufen zu Zaehlung
const getEvaluationCategory = (status: StatusType): "positive" | "neutral" | "negative" => {
  switch (status) {
    case "green":
    case "im_regionalen_rahmen":
      return "positive";
    case "yellow":
    case "leicht_ueber_vergleich":
    case "nicht_einordenbar":
      return "neutral";
    case "red":
    case "auffaellig_hoch":
    case "auffaellig_niedrig":
      return "negative";
    default:
      return "neutral";
  }
};

interface Position {
  id: string;
  position_nummer: number;
  beschreibung: string;
  material: string | null;
  menge: number | null;
  einheit: string | null;
  einzelpreis: number | null;
  gesamtpreis: number | null;
  status: string | null;
  plausibility_score: number | null;
  hinweis: string | null;
  marktpreis_min: number | null;
  marktpreis_max: number | null;
  marktpreis_durchschnitt: number | null;
  abweichung_prozent: number | null;
  // Neue Felder fuer Bewertungs-Engine
  einordnung_stufe: string | null;
  einordnung_begruendung: string | null;
  datengrundlage: string | null;
  unsicherheitshinweis: string | null;
  datenquelle: string | null;
  interne_vergleiche: number | null;
}

interface Angebot {
  id: string;
  title: string;
  handwerker_firma: string | null;
  handwerker_name: string | null;
  stadt: string | null;
  plz: string | null;
  gesamtpreis: number | null;
  plausibility_score: number | null;
  status: string;
  analysis_summary: string | null;
  created_at: string;
  positionen: Position[];
}

interface AnalysisViewProps {
  angebotId: string;
  onBack: () => void;
}

export function AnalysisView({ angebotId, onBack }: AnalysisViewProps) {
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchAngebot();
  }, [angebotId]);

  const fetchAngebot = async () => {
    const { data, error } = await supabase
      .from("angebote")
      .select(`
        *,
        positionen (*)
      `)
      .eq("id", angebotId)
      .single();

    if (error) {
      console.error("Error fetching angebot:", error);
      toast({
        title: "Fehler",
        description: "Angebot konnte nicht geladen werden.",
        variant: "destructive",
      });
      onBack();
      return;
    }

    // Sort positions by position_nummer
    if (data.positionen) {
      data.positionen.sort((a: Position, b: Position) => 
        (a.position_nummer || 0) - (b.position_nummer || 0)
      );
    }

    setAngebot(data as Angebot);
    setLoading(false);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-report", {
        body: { angebotId },
      });

      if (error) throw error;

      const blob = new Blob([data.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast({
        title: "PDF erstellt",
        description: "Der Report wurde im neuen Fenster geöffnet. Nutzen Sie Drucken → Als PDF speichern.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Fehler",
        description: "PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!angebot) return null;

  // Zaehlung basierend auf neuen Bewertungsstufen
  const evaluationCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  angebot.positionen?.forEach((pos) => {
    const status = toStatusType(pos.einordnung_stufe || pos.status);
    const category = getEvaluationCategory(status);
    evaluationCounts[category]++;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </button>

          <Button onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF Report
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title & Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {angebot.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            {angebot.handwerker_firma && (
              <span>{angebot.handwerker_firma}</span>
            )}
            {angebot.stadt && (
              <span>
                {angebot.plz} {angebot.stadt}
              </span>
            )}
            <span>
              {new Date(angebot.created_at).toLocaleDateString("de-DE")}
            </span>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-6 border border-border shadow-sm"
          >
            <p className="text-sm text-muted-foreground mb-2">Plausibilitäts-Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(angebot.plausibility_score)}`}>
              {angebot.plausibility_score || "-"}/100
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-6 border border-border shadow-sm"
          >
            <p className="text-sm text-muted-foreground mb-2">Angebotssumme</p>
            <p className="text-3xl font-bold text-foreground">
              {angebot.gesamtpreis?.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              }) || "-"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-6 border border-border shadow-sm col-span-2"
          >
            <p className="text-sm text-muted-foreground mb-3">Einordnung der Positionen</p>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground">{evaluationCounts.positive}</span>
                <span className="text-sm text-muted-foreground">Im Rahmen</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-semibold text-foreground">{evaluationCounts.neutral}</span>
                <span className="text-sm text-muted-foreground">Prüfenswert</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-semibold text-foreground">{evaluationCounts.negative}</span>
                <span className="text-sm text-muted-foreground">Auffällig</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Summary */}
        {angebot.analysis_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-accent/50 rounded-xl p-6 mb-8 border-l-4 border-primary"
          >
            <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Zusammenfassung
            </h2>
            <p className="text-muted-foreground whitespace-pre-line">
              {angebot.analysis_summary}
            </p>
          </motion.div>
        )}

        {/* Positions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">
              Detailanalyse ({angebot.positionen?.length || 0} Positionen)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Nr.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Position
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">
                    Menge
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">
                    EP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Gesamt
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                    Einordnung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {angebot.positionen?.map((pos, idx) => {
                  const evaluationStatus = toStatusType(pos.einordnung_stufe || pos.status);
                  const hasNewEvaluation = !!pos.einordnung_stufe;
                  
                  return (
                    <>
                      <tr key={pos.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {pos.position_nummer || idx + 1}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-foreground text-sm">
                            {pos.beschreibung}
                          </p>
                          {pos.material && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pos.material}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-muted-foreground hidden md:table-cell">
                          {pos.menge || "-"} {pos.einheit || ""}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-muted-foreground hidden md:table-cell">
                          {pos.einzelpreis
                            ? `${pos.einzelpreis.toFixed(2)} €`
                            : "-"}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-foreground">
                          {pos.gesamtpreis
                            ? `${pos.gesamtpreis.toFixed(2)} €`
                            : "-"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={evaluationStatus} size="sm" />
                        </td>
                      </tr>
                      {/* Detail Row mit Datengrundlage */}
                      <tr className="bg-muted/20">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-2 text-xs">
                            {/* Begruendung */}
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-foreground shrink-0">Einordnung:</span>
                              <span className="text-muted-foreground">
                                {pos.einordnung_begruendung || pos.hinweis || "Keine Hinweise"}
                              </span>
                            </div>
                            
                            {/* Datengrundlage - Neue Anzeige */}
                            {hasNewEvaluation && pos.datengrundlage && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Database className="w-3 h-3 shrink-0" />
                                <span className="font-medium">Datengrundlage:</span>
                                <span>{pos.datengrundlage}</span>
                                {pos.datenquelle === "external_only" && (
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <ExternalLink className="w-3 h-3" />
                                    Externe Referenz
                                  </span>
                                )}
                                {pos.datenquelle === "mixed" && (
                                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Database className="w-3 h-3" />
                                    Gemischt
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Unsicherheitshinweis */}
                            {pos.unsicherheitshinweis && (
                              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{pos.unsicherheitshinweis}</span>
                              </div>
                            )}

                            {/* Marktpreis & Abweichung (Legacy-Anzeige) */}
                            <div className="flex flex-wrap items-center gap-4">
                              {pos.marktpreis_durchschnitt && (
                                <div className="text-muted-foreground">
                                  <span className="font-medium">Vergleichswert: </span>
                                  {pos.marktpreis_min?.toFixed(2)} - {pos.marktpreis_max?.toFixed(2)} €
                                  <span className="ml-1">(Ø {pos.marktpreis_durchschnitt?.toFixed(2)} €)</span>
                                </div>
                              )}
                              {pos.abweichung_prozent !== null && (
                                <div className={`flex items-center gap-1 ${
                                  Math.abs(pos.abweichung_prozent) >= 30 
                                    ? "text-red-600 dark:text-red-400" 
                                    : Math.abs(pos.abweichung_prozent) >= 15 
                                    ? "text-amber-600 dark:text-amber-400" 
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  {pos.abweichung_prozent > 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : pos.abweichung_prozent < 0 ? (
                                    <TrendingDown className="w-3 h-3" />
                                  ) : (
                                    <Minus className="w-3 h-3" />
                                  )}
                                  <span className="font-medium">
                                    {pos.abweichung_prozent > 0 ? "+" : ""}
                                    {pos.abweichung_prozent?.toFixed(1)}% Abweichung
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td colSpan={4} className="px-4 py-4 text-foreground">
                    Gesamtsumme
                  </td>
                  <td className="px-4 py-4 text-right text-foreground">
                    {angebot.gesamtpreis?.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    }) || "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-bold ${getScoreColor(angebot.plausibility_score)}`}>
                      {angebot.plausibility_score}/100
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>

        {/* Hinweis zur Datenaktualitaet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-xs text-muted-foreground text-center"
        >
          <p>
            Die Preiseinordnung basiert auf Vergleichsdaten der letzten 12 Monate aus der jeweiligen Region.
            Alle Angaben sind indikativ und ersetzen keine fachliche Beratung.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
