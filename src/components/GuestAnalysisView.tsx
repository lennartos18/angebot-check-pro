import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  Save,
  Lock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  ArrowRight,
  Database,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GuestAnalysisResult } from "./GuestUploadModal";

interface GuestAnalysisViewProps {
  analysis: GuestAnalysisResult;
  onClose: () => void;
  onLoginRequired: () => void;
}

// Neue Bewertungsstufen
type EvaluationLevel = 
  | "im_regionalen_rahmen"
  | "leicht_ueber_vergleich"
  | "auffaellig_hoch"
  | "auffaellig_niedrig"
  | "nicht_einordenbar";

type LegacyStatus = "green" | "yellow" | "red";
type StatusType = LegacyStatus | EvaluationLevel;

const toStatusType = (status: string | null | undefined): StatusType => {
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

// Kategorisierung fuer Zaehlung
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

export function GuestAnalysisView({ analysis, onClose, onLoginRequired }: GuestAnalysisViewProps) {
  const navigate = useNavigate();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [loginAction, setLoginAction] = useState<"save" | "pdf" | "compare">("save");

  const handlePremiumAction = (action: "save" | "pdf" | "compare") => {
    setLoginAction(action);
    setShowLoginWall(true);
  };

  const handleLogin = () => {
    localStorage.setItem("pendingAction", loginAction);
    navigate("/auth");
  };

  // Zaehlung mit neuen Kategorien
  const evaluationCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  analysis.positionen.forEach((pos) => {
    const status = toStatusType(pos.einordnung_stufe || pos.status);
    const category = getEvaluationCategory(status);
    evaluationCounts[category]++;
  });

  // Determine overall status
  const getOverallStatus = (): StatusType => {
    if (analysis.plausibility_score >= 80) return "im_regionalen_rahmen";
    if (analysis.plausibility_score >= 50) return "leicht_ueber_vergleich";
    return "auffaellig_hoch";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <DialogTitle className="text-xl">
                    {analysis.titel || "Analyse Ergebnis"}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">Kostenlose Analyse</p>
                </div>
              </div>
              <StatusBadge status={getOverallStatus()} size="lg" />
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Score Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Plausibilität</p>
                <p className={`text-3xl font-bold ${getScoreColor(analysis.plausibility_score)}`}>
                  {analysis.plausibility_score}%
                </p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Gesamtpreis</p>
                <p className="text-3xl font-bold text-foreground">
                  {analysis.gesamtpreis?.toLocaleString("de-DE")}€
                </p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Positionen</p>
                <p className="text-3xl font-bold text-foreground">
                  {analysis.positionen.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Einordnung</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {evaluationCounts.positive}
                  </span>
                  <span className="flex items-center gap-1">
                    <Minus className="w-4 h-4 text-amber-500" />
                    {evaluationCounts.neutral}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    {evaluationCounts.negative}
                  </span>
                </div>
              </Card>
            </motion.div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-2">Zusammenfassung</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {analysis.analysis_summary}
                </p>
              </Card>
            </motion.div>

            {/* Positions Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Positionen</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                          Beschreibung
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                          Menge
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                          Preis
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                          Einordnung
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.positionen.map((pos, idx) => {
                        const evaluationStatus = toStatusType(pos.einordnung_stufe || pos.status);
                        
                        return (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground text-sm">
                                {pos.beschreibung}
                              </p>
                              {/* Datengrundlage - Professionelle Anzeige */}
                              {pos.datengrundlage && (
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                  <Database className="w-3 h-3" />
                                  <span>{pos.datengrundlage}</span>
                                </div>
                              )}
                              {/* Begründung */}
                              {(pos.einordnung_begruendung || pos.hinweis) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pos.einordnung_begruendung || pos.hinweis}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                              {pos.menge} {pos.einheit}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-medium text-foreground text-sm">
                                {pos.gesamtpreis?.toLocaleString("de-DE")}€
                              </p>
                              {pos.abweichung_prozent !== undefined && pos.abweichung_prozent !== 0 && (
                                <p className={`text-xs flex items-center justify-end gap-1 ${
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
                                  {pos.abweichung_prozent > 0 ? "+" : ""}{pos.abweichung_prozent}%
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={evaluationStatus} size="sm" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>

            {/* Hinweis zur Datenaktualität */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-xs text-muted-foreground text-center"
            >
              <p>
                Die Preiseinordnung basiert auf Vergleichsdaten der letzten 12 Monate.
                Alle Angaben sind indikativ und ersetzen keine fachliche Beratung.
              </p>
            </motion.div>

            {/* Premium CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Mehr aus Ihrer Analyse herausholen
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Registrieren Sie sich kostenlos für PDF-Export, Speichern und Angebotsvergleich
                    </p>
                  </div>
                  <Button onClick={() => handlePremiumAction("save")} className="group whitespace-nowrap">
                    Kostenlos registrieren
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => handlePremiumAction("pdf")}
                className="gap-2"
              >
                <Lock className="w-4 h-4" />
                <Download className="w-4 h-4" />
                PDF herunterladen
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePremiumAction("save")}
                className="gap-2"
              >
                <Lock className="w-4 h-4" />
                <Save className="w-4 h-4" />
                Analyse speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Wall Dialog */}
      <Dialog open={showLoginWall} onOpenChange={setShowLoginWall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {loginAction === "pdf" && "PDF-Export freischalten"}
              {loginAction === "save" && "Analyse speichern"}
              {loginAction === "compare" && "Angebote vergleichen"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground">
                {loginAction === "pdf" && "Laden Sie den detaillierten PDF-Report herunter – mit Ihrer kostenlosen Registrierung."}
                {loginAction === "save" && "Speichern Sie Ihre Analyse im Dashboard und greifen Sie jederzeit darauf zu."}
                {loginAction === "compare" && "Vergleichen Sie mehrere Angebote und finden Sie das beste Preis-Leistungs-Verhältnis."}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm text-foreground">Das bekommen Sie kostenlos:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Unbegrenzte Analysen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  PDF-Export aller Analysen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Dashboard zum Vergleichen
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleLogin} className="w-full">
                Jetzt kostenlos registrieren
              </Button>
              <Button variant="ghost" onClick={() => setShowLoginWall(false)} className="w-full">
                Später
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
