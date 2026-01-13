import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Download, Save, Lock, CheckCircle2, AlertTriangle, HelpCircle, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface GuestPosition {
  position_nummer?: number;
  beschreibung: string;
  material?: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  einordnung_stufe?: string;
  einordnung_begruendung?: string;
  marktpreis_min?: number;
  marktpreis_max?: number;
  marktpreis_durchschnitt?: number;
  abweichung_prozent?: number;
  datengrundlage?: string;
  hinweis?: string;
  status?: string;
  plausibility_score?: number;
}

export interface GuestAnalysisResult {
  success: boolean;
  document_type?: string;
  handwerker_name?: string;
  handwerker_firma?: string;
  plz?: string;
  stadt?: string;
  region?: string;
  service_domain?: string;
  gesamtpreis?: number;
  plausibility_score?: number;
  analysis_summary?: string;
  positionen?: GuestPosition[];
}

interface GuestAnalysisViewProps {
  analysis: GuestAnalysisResult;
  onClose: () => void;
  onLoginRequired: () => void;
}

type StatusType = 
  | 'im_regionalen_rahmen' 
  | 'leicht_ueber_vergleich' 
  | 'leicht_unter_vergleich'
  | 'auffaellig_hoch' 
  | 'auffaellig_niedrig' 
  | 'nicht_einordenbar'
  | 'green' | 'yellow' | 'red';

const toStatusType = (status: string | null | undefined): StatusType => {
  if (!status) return 'nicht_einordenbar';
  const normalized = status.toLowerCase().replace(/[äöü]/g, (match) => {
    return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[match] || match;
  });
  
  // Map legacy statuses
  if (normalized === 'green' || normalized === 'ok') return 'im_regionalen_rahmen';
  if (normalized === 'yellow' || normalized === 'warning') return 'leicht_ueber_vergleich';
  if (normalized === 'red' || normalized === 'critical') return 'auffaellig_hoch';
  
  const validStatuses: StatusType[] = [
    'im_regionalen_rahmen', 'leicht_ueber_vergleich', 'leicht_unter_vergleich',
    'auffaellig_hoch', 'auffaellig_niedrig', 'nicht_einordenbar'
  ];
  
  if (validStatuses.includes(normalized as StatusType)) {
    return normalized as StatusType;
  }
  return 'nicht_einordenbar';
};

const getStatusConfig = (status: StatusType) => {
  switch (status) {
    case 'im_regionalen_rahmen':
    case 'green':
      return {
        label: 'Im Rahmen',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: CheckCircle2,
        iconColor: 'text-emerald-600',
        category: 'positive' as const
      };
    case 'leicht_ueber_vergleich':
    case 'yellow':
      return {
        label: 'Leicht erhöht',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: TrendingUp,
        iconColor: 'text-amber-600',
        category: 'neutral' as const
      };
    case 'leicht_unter_vergleich':
      return {
        label: 'Leicht unter',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: TrendingDown,
        iconColor: 'text-blue-600',
        category: 'positive' as const
      };
    case 'auffaellig_hoch':
    case 'red':
      return {
        label: 'Auffällig hoch',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: AlertTriangle,
        iconColor: 'text-red-600',
        category: 'negative' as const
      };
    case 'auffaellig_niedrig':
      return {
        label: 'Auffällig niedrig',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: TrendingDown,
        iconColor: 'text-orange-600',
        category: 'neutral' as const
      };
    default:
      return {
        label: 'Nicht einordenbar',
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: HelpCircle,
        iconColor: 'text-gray-500',
        category: 'unknown' as const
      };
  }
};

const getScoreColor = (score: number) => {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const getScoreBg = (score: number) => {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
};

export function GuestAnalysisView({ analysis, onClose, onLoginRequired }: GuestAnalysisViewProps) {
  const navigate = useNavigate();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [loginAction, setLoginAction] = useState<"save" | "pdf" | "compare">("save");

  // Count evaluations by category
  const evaluationCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
    unknown: 0
  };

  analysis.positionen?.forEach(pos => {
    const status = toStatusType(pos.einordnung_stufe || pos.status);
    const config = getStatusConfig(status);
    if (config.category === 'positive') evaluationCounts.positive++;
    else if (config.category === 'neutral') evaluationCounts.neutral++;
    else if (config.category === 'negative') evaluationCounts.negative++;
    else evaluationCounts.unknown++;
  });

  const handlePremiumAction = (action: "save" | "pdf" | "compare") => {
    setLoginAction(action);
    setShowLoginWall(true);
  };

  const handleLogin = () => {
    localStorage.setItem('pendingAction', loginAction);
    navigate('/auth');
  };

  const score = analysis.plausibility_score || 0;
  const totalPositions = analysis.positionen?.length || 0;

  return (
    <TooltipProvider>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <DialogHeader className="sticky top-0 bg-background z-10 p-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Analyse-Ergebnis
                </DialogTitle>
                <p className="text-muted-foreground mt-1">
                  {analysis.document_type || 'Dokument'} 
                  {analysis.handwerker_firma && ` von ${analysis.handwerker_firma}`}
                  {analysis.stadt && ` • ${analysis.stadt}`}
                  {analysis.plz && ` (${analysis.plz})`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Score Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Plausibility Score */}
              <Card className={`border-2 ${getScoreBg(score)}`}>
                <CardContent className="p-4 text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                    {score}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Plausibilität</div>
                </CardContent>
              </Card>

              {/* Total Price */}
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {analysis.gesamtpreis?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Gesamtpreis</div>
                </CardContent>
              </Card>

              {/* Positions Count */}
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {totalPositions}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Positionen</div>
                </CardContent>
              </Card>

              {/* Service Domain */}
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <div className="text-xl font-bold text-foreground truncate">
                    {analysis.service_domain || 'Allgemein'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Gewerk</div>
                </CardContent>
              </Card>
            </div>

            {/* Status Summary Bar */}
            <Card className="border bg-muted/30">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Bewertung:</span>
                  
                  {evaluationCounts.positive > 0 && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">
                        {evaluationCounts.positive} im Rahmen
                      </span>
                    </div>
                  )}
                  
                  {evaluationCounts.neutral > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Minus className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700">
                        {evaluationCounts.neutral} prüfenswert
                      </span>
                    </div>
                  )}
                  
                  {evaluationCounts.negative > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700">
                        {evaluationCounts.negative} auffällig
                      </span>
                    </div>
                  )}

                  {evaluationCounts.unknown > 0 && (
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-600">
                        {evaluationCounts.unknown} nicht einordenbar
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            {analysis.analysis_summary && (
              <Card className="border-l-4 border-l-primary bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Zusammenfassung</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {analysis.analysis_summary}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Positions List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Einzelpositionen</h3>
              <div className="space-y-3">
                {analysis.positionen?.map((position, index) => {
                  const status = toStatusType(position.einordnung_stufe || position.status);
                  const config = getStatusConfig(status);
                  const StatusIcon = config.icon;

                  return (
                    <Card key={index} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                Pos. {position.position_nummer || index + 1}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className={`${config.color} border cursor-help`}>
                                    <StatusIcon className={`h-3 w-3 mr-1 ${config.iconColor}`} />
                                    {config.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium">{position.einordnung_begruendung || position.hinweis || 'Keine Details verfügbar'}</p>
                                  {position.datengrundlage && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Quelle: {position.datengrundlage}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            <h4 className="font-medium text-foreground mb-1 line-clamp-2">
                              {position.beschreibung}
                            </h4>

                            {/* Price and Market Comparison */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2">
                              <span className="font-semibold text-foreground">
                                {position.gesamtpreis?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
                              </span>
                              
                              {position.menge && position.einheit && (
                                <span className="text-muted-foreground">
                                  {position.menge} {position.einheit}
                                  {position.einzelpreis && ` × ${position.einzelpreis.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€`}
                                </span>
                              )}

                              {position.marktpreis_durchschnitt && (
                                <span className="text-muted-foreground">
                                  Markt: Ø {position.marktpreis_durchschnitt.toLocaleString('de-DE')}€
                                  {position.marktpreis_min && position.marktpreis_max && (
                                    <span className="text-xs ml-1">
                                      ({position.marktpreis_min.toLocaleString('de-DE')}-{position.marktpreis_max.toLocaleString('de-DE')}€)
                                    </span>
                                  )}
                                </span>
                              )}

                              {position.abweichung_prozent !== null && position.abweichung_prozent !== undefined && (
                                <span className={`font-medium ${
                                  position.abweichung_prozent > 15 ? 'text-red-600' : 
                                  position.abweichung_prozent < -15 ? 'text-blue-600' : 
                                  'text-emerald-600'
                                }`}>
                                  {position.abweichung_prozent > 0 ? '+' : ''}{position.abweichung_prozent.toFixed(0)}%
                                </span>
                              )}
                            </div>

                            {/* Hint */}
                            {position.hinweis && position.hinweis !== 'Keine weiteren Hinweise' && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                💡 {position.hinweis}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Data Basis Info */}
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Hinweis zur Datengrundlage</p>
                    <p>
                      Diese Analyse basiert auf internen Marktdaten und allgemeinen Branchenkenntnissen für Deutschland.
                      Die Bewertung dient der Orientierung und ersetzt keine fachliche Beratung.
                      {analysis.plz && ` Regionale Besonderheiten für PLZ ${analysis.plz} wurden berücksichtigt.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium CTA */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                      <Lock className="h-5 w-5 text-primary" />
                      Premium-Funktionen freischalten
                    </h4>
                    <p className="text-muted-foreground text-sm mt-1">
                      Speichern Sie Ihre Analyse, laden Sie einen PDF-Report herunter oder vergleichen Sie mehrere Angebote.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePremiumAction("pdf")}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF Report
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePremiumAction("save")}>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                    <Button size="sm" onClick={() => handlePremiumAction("compare")}>
                      Kostenlos registrieren
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Wall Dialog */}
      <Dialog open={showLoginWall} onOpenChange={setShowLoginWall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {loginAction === "pdf" && "PDF-Report herunterladen"}
              {loginAction === "save" && "Analyse speichern"}
              {loginAction === "compare" && "Angebote vergleichen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Erstellen Sie ein kostenloses Konto, um diese Funktion zu nutzen:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Unbegrenzt Analysen speichern
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                PDF-Reports herunterladen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Mehrere Angebote vergleichen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Dauerhaft kostenlos
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
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
