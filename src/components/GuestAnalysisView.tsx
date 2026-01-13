import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  X, 
  Download, 
  Save, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Info, 
  TrendingUp, 
  TrendingDown,
  MapPin,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { StatusBadge, EvaluationLevel } from "./StatusBadge";

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
  interne_vergleiche?: number;
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

// Convert various status strings to normalized EvaluationLevel
const toStatusType = (status: string | null | undefined): EvaluationLevel => {
  if (!status) return 'nicht_einordenbar';
  const normalized = status.toLowerCase().replace(/[äöü]/g, (match) => {
    return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[match] || match;
  }).replace(/[\s-]+/g, '_');
  
  // Map various status strings
  if (normalized.includes('im_rahmen') || normalized === 'green' || normalized === 'ok') {
    return 'im_regionalen_rahmen';
  }
  if (normalized.includes('leicht_ueber') || normalized.includes('leicht_uber') || normalized === 'yellow' || normalized === 'warning') {
    return 'leicht_ueber_vergleich';
  }
  if (normalized.includes('auffaellig_hoch') || normalized.includes('auffällig_hoch') || normalized === 'red' || normalized === 'critical') {
    return 'auffaellig_hoch';
  }
  if (normalized.includes('auffaellig_niedrig') || normalized.includes('auffällig_niedrig')) {
    return 'auffaellig_niedrig';
  }
  
  return 'nicht_einordenbar';
};

// Status configuration for summary display
const statusConfig: Record<string, { label: string; shortLabel: string; dotClass: string; category: 'positive' | 'neutral' | 'negative' | 'unknown' }> = {
  'im_regionalen_rahmen': {
    label: 'Im regionalen Rahmen',
    shortLabel: 'im Rahmen',
    dotClass: 'bg-green-500',
    category: 'positive'
  },
  'leicht_ueber_vergleich': {
    label: 'Leicht über Vergleich',
    shortLabel: 'prüfenswert',
    dotClass: 'bg-yellow-500',
    category: 'neutral'
  },
  'auffaellig_hoch': {
    label: 'Auffällig hoch',
    shortLabel: 'auffällig',
    dotClass: 'bg-red-500',
    category: 'negative'
  },
  'auffaellig_niedrig': {
    label: 'Auffällig niedrig',
    shortLabel: 'auffällig niedrig',
    dotClass: 'bg-orange-500',
    category: 'negative'
  },
  'nicht_einordenbar': {
    label: 'Nicht einordenbar',
    shortLabel: 'unklar',
    dotClass: 'bg-muted-foreground',
    category: 'unknown'
  }
};

// Calculate status counts
function getStatusCounts(positionen: GuestPosition[]) {
  const counts: Record<EvaluationLevel, number> = {
    'im_regionalen_rahmen': 0,
    'leicht_ueber_vergleich': 0,
    'auffaellig_hoch': 0,
    'auffaellig_niedrig': 0,
    'nicht_einordenbar': 0
  };
  
  positionen.forEach(pos => {
    const status = toStatusType(pos.einordnung_stufe || pos.status);
    counts[status]++;
  });
  
  return counts;
}

// Status Summary component for header
function StatusSummary({ counts }: { counts: Record<EvaluationLevel, number> }) {
  const displayOrder: EvaluationLevel[] = [
    'im_regionalen_rahmen',
    'leicht_ueber_vergleich',
    'auffaellig_hoch',
    'auffaellig_niedrig'
  ];
  
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {displayOrder.map(status => {
        const count = counts[status];
        if (count === 0) return null;
        const config = statusConfig[status];
        return (
          <div key={status} className="flex items-center gap-1.5 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`}></span>
            <span className="text-muted-foreground">
              {count} {config.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function GuestAnalysisView({ analysis, onClose, onLoginRequired }: GuestAnalysisViewProps) {
  const navigate = useNavigate();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [loginAction, setLoginAction] = useState<"save" | "pdf" | "compare">("save");

  const positionen = analysis.positionen || [];
  const statusCounts = getStatusCounts(positionen);
  
  // Calculate total comparisons
  const totalComparisons = positionen.reduce((sum, pos) => sum + (pos.interne_vergleiche || 0), 0);
  
  // Get current quarter
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  const handlePremiumAction = (action: "save" | "pdf" | "compare") => {
    setLoginAction(action);
    setShowLoginWall(true);
  };

  const handleLogin = () => {
    localStorage.setItem('pendingAction', loginAction);
    navigate('/auth');
  };

  return (
    <TooltipProvider>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Analyse-Ergebnis
            </DialogTitle>
            <DialogDescription>
              Kostenlose Vorschau Ihrer Angebots-Analyse
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Main Analysis Card with Table */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">
                      Angebot: {analysis.service_domain || 'Handwerkerleistung'}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {(analysis.stadt || analysis.plz) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {[analysis.plz, analysis.stadt].filter(Boolean).join(' ')}
                        </div>
                      )}
                      {analysis.handwerker_firma && (
                        <span>• {analysis.handwerker_firma}</span>
                      )}
                    </div>
                  </div>
                  <StatusSummary counts={statusCounts} />
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[40%]">Position</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Menge</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positionen.map((pos, index) => {
                        const status = toStatusType(pos.einordnung_stufe || pos.status);
                        const hasDetails = pos.einordnung_begruendung || pos.marktpreis_durchschnitt || pos.hinweis;
                        
                        return (
                          <TableRow 
                            key={index} 
                            className="hover:bg-muted/30"
                          >
                            <TableCell className="font-medium">
                              {pos.beschreibung}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {pos.material || '–'}
                            </TableCell>
                            <TableCell className="text-right">
                              {pos.menge != null ? `${pos.menge} ${pos.einheit || ''}`.trim() : '–'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <StatusBadge status={status} size="sm" />
                                {hasDetails && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button className="p-1 rounded-full hover:bg-muted/50 transition-colors">
                                        <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent 
                                      side="left" 
                                      className="max-w-xs p-3 space-y-2"
                                    >
                                      {pos.einordnung_begruendung && (
                                        <p className="text-sm">{pos.einordnung_begruendung}</p>
                                      )}
                                      {pos.marktpreis_durchschnitt && (
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                          <p>
                                            Marktpreis: Ø {pos.marktpreis_durchschnitt.toLocaleString('de-DE')}€
                                            {pos.marktpreis_min != null && pos.marktpreis_max != null && (
                                              <span className="ml-1">
                                                ({pos.marktpreis_min.toLocaleString('de-DE')}–{pos.marktpreis_max.toLocaleString('de-DE')}€)
                                              </span>
                                            )}
                                          </p>
                                          {pos.abweichung_prozent != null && (
                                            <p>
                                              Abweichung: {pos.abweichung_prozent > 0 ? '+' : ''}{pos.abweichung_prozent.toFixed(0)}%
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      {pos.hinweis && pos.hinweis !== 'Keine weiteren Hinweise' && (
                                        <p className="text-xs italic text-muted-foreground border-t border-border pt-2 mt-2">
                                          💡 {pos.hinweis}
                                        </p>
                                      )}
                                      {pos.datengrundlage && (
                                        <p className="text-xs text-muted-foreground/70">
                                          Quelle: {pos.datengrundlage}
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {positionen.map((pos, index) => {
                    const status = toStatusType(pos.einordnung_stufe || pos.status);
                    const hasDetails = pos.einordnung_begruendung || pos.marktpreis_durchschnitt || pos.hinweis;
                    
                    return (
                      <div 
                        key={index} 
                        className="p-3 rounded-lg border border-border/50 bg-card space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium flex-1">{pos.beschreibung}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StatusBadge status={status} size="sm" />
                            {hasDetails && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="p-1 rounded-full hover:bg-muted/50">
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3 space-y-2">
                                  {pos.einordnung_begruendung && (
                                    <p className="text-sm">{pos.einordnung_begruendung}</p>
                                  )}
                                  {pos.marktpreis_durchschnitt && (
                                    <p className="text-xs text-muted-foreground">
                                      Markt: Ø {pos.marktpreis_durchschnitt.toLocaleString('de-DE')}€
                                    </p>
                                  )}
                                  {pos.hinweis && pos.hinweis !== 'Keine weiteren Hinweise' && (
                                    <p className="text-xs italic">💡 {pos.hinweis}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {pos.material && <span>{pos.material}</span>}
                          {pos.menge != null && (
                            <span>{pos.menge} {pos.einheit || ''}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer with data basis */}
                <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Basierend auf {totalComparisons > 0 ? `${totalComparisons} ` : ''}regionalen Vergleichspositionen
                    {analysis.stadt && `, Region ${analysis.stadt}`}
                    {analysis.plz && !analysis.stadt && `, PLZ ${analysis.plz}`}
                    {', '}
                    {quarter}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats Row */}
            {(analysis.gesamtpreis || analysis.plausibility_score) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {analysis.plausibility_score != null && (
                  <Card className="p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">Plausibilität</div>
                    <div className={`text-xl font-bold ${
                      analysis.plausibility_score >= 75 ? 'text-green-600' : 
                      analysis.plausibility_score >= 50 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {analysis.plausibility_score}%
                    </div>
                  </Card>
                )}
                {analysis.gesamtpreis != null && (
                  <Card className="p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">Gesamtpreis</div>
                    <div className="text-xl font-bold">
                      {analysis.gesamtpreis.toLocaleString('de-DE')}€
                    </div>
                  </Card>
                )}
                <Card className="p-3 border">
                  <div className="text-xs text-muted-foreground mb-1">Positionen</div>
                  <div className="text-xl font-bold">{positionen.length}</div>
                </Card>
                {analysis.service_domain && (
                  <Card className="p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">Gewerk</div>
                    <div className="text-lg font-bold truncate">{analysis.service_domain}</div>
                  </Card>
                )}
              </div>
            )}

            {/* Analysis Summary */}
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

            {/* Premium CTA */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Premium-Funktionen freischalten</h4>
                      <p className="text-sm text-muted-foreground">
                        PDF-Report, Analyse speichern & Angebote vergleichen
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePremiumAction("pdf")}
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePremiumAction("save")}
                      className="flex-1 sm:flex-none"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handlePremiumAction("compare")}
                      className="flex-1 sm:flex-none"
                    >
                      Registrieren
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {loginAction === "pdf" && "PDF-Report herunterladen"}
              {loginAction === "save" && "Analyse speichern"}
              {loginAction === "compare" && "Angebote vergleichen"}
            </DialogTitle>
            <DialogDescription>
              Erstellen Sie ein kostenloses Konto, um auf alle Funktionen zuzugreifen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Detaillierter PDF-Report zum Download</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Ausführliche Marktpreis-Analyse</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Unbegrenzte Angebots-Analysen</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Vergleich mehrerer Angebote</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleLogin} className="w-full">
                Kostenlos registrieren
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowLoginWall(false)}
                className="w-full"
              >
                Zurück zur Analyse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
