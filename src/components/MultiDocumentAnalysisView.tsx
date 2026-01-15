import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileText, 
  BarChart3,
  Download,
  Lock,
  Info,
  MapPin,
  ArrowLeft,
  Home,
  Sparkles
} from 'lucide-react';
import { StatusBadge, EvaluationLevel } from './StatusBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Header } from './Header';

interface ConfidenceInfo {
  level: 'hoch' | 'mittel' | 'eingeschraenkt';
  reason: string;
  samples: number;
}

interface Position {
  beschreibung: string;
  material?: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  einordnung_stufe?: string;
  einordnung_begruendung?: string;
  abweichung_prozent?: number;
  datengrundlage?: string;
  datenquelle?: string;
  marktpreis_min?: number;
  marktpreis_max?: number;
  marktpreis_durchschnitt?: number;
  hinweis?: string;
  confidence?: ConfidenceInfo;
}

// Map datengrundlage to user-friendly display text
function getDataSourceDisplay(datengrundlage?: string, datenquelle?: string): string {
  if (!datengrundlage && !datenquelle) return 'KI-gestützte Markteinschätzung';
  
  const source = datengrundlage?.toLowerCase() || '';
  
  if (source.includes('interne') && source.includes('markt')) {
    return 'Interne Vergleichsdaten';
  }
  if (source.includes('branchendurchschnitt') || source.includes('deutschland')) {
    return 'KI-gestützte Markteinschätzung (Bundesweit)';
  }
  if (source.includes('externe') || source.includes('firecrawl') || source.includes('web')) {
    return 'Externe Preisrecherche (Web)';
  }
  if (source.includes('gemini') || source.includes('ki') || source.includes('ai')) {
    return 'KI-gestützte Marktanalyse';
  }
  if (source.includes('regional')) {
    return 'Regionale Vergleichsdaten';
  }
  if (source.includes('allgemein') || source.includes('schätzung')) {
    return 'KI-Schätzung auf Basis öffentlicher Preisdaten';
  }
  
  return datengrundlage || 'KI-gestützte Markteinschätzung';
}

interface DocumentResult {
  documentIndex: number;
  fileName: string;
  status: 'success' | 'error';
  error?: string;
  positionen?: Position[];
  gesamtpreis?: number;
  plausibility_score?: number;
  service_domain?: string;
  handwerker_name?: string;
  handwerker_firma?: string;
  analysis_summary?: string;
}

interface MultiDocumentAnalysisViewProps {
  analysisData: {
    documents: DocumentResult[];
    plz?: string;
    stadt?: string;
    documentCount: number;
  };
  onRequestPDF: () => void;
  onClose: () => void;
}

// Convert status string to EvaluationLevel
const toEvaluationLevel = (stufe?: string): EvaluationLevel => {
  if (!stufe) return 'nicht_einordenbar';
  const normalized = stufe.toLowerCase().replace(/[äöü]/g, (match) => {
    return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[match] || match;
  }).replace(/[\s-]+/g, '_');
  
  if (normalized.includes('im_rahmen') || normalized.includes('rahmen')) {
    return 'im_regionalen_rahmen';
  }
  if (normalized.includes('leicht_ueber') || normalized.includes('leicht_uber') || normalized.includes('leicht')) {
    return 'leicht_ueber_vergleich';
  }
  if (normalized.includes('auffaellig_hoch') || normalized.includes('hoch')) {
    return 'auffaellig_hoch';
  }
  if (normalized.includes('auffaellig_niedrig') || normalized.includes('niedrig')) {
    return 'auffaellig_niedrig';
  }
  
  return 'nicht_einordenbar';
};

// Status configuration for summary
const statusConfig: Record<EvaluationLevel, { label: string; shortLabel: string; dotClass: string }> = {
  'im_regionalen_rahmen': { label: 'Im regionalen Rahmen', shortLabel: 'im Rahmen', dotClass: 'bg-green-500' },
  'leicht_ueber_vergleich': { label: 'Leicht über Vergleich', shortLabel: 'prüfenswert', dotClass: 'bg-yellow-500' },
  'auffaellig_hoch': { label: 'Auffällig hoch', shortLabel: 'auffällig', dotClass: 'bg-red-500' },
  'auffaellig_niedrig': { label: 'Auffällig niedrig', shortLabel: 'auffällig niedrig', dotClass: 'bg-orange-500' },
  'nicht_einordenbar': { label: 'Nicht einordenbar', shortLabel: 'unklar', dotClass: 'bg-gray-400' }
};

// Calculate status counts for a document
function getStatusCounts(positionen: Position[]) {
  const counts: Record<EvaluationLevel, number> = {
    'im_regionalen_rahmen': 0,
    'leicht_ueber_vergleich': 0,
    'auffaellig_hoch': 0,
    'auffaellig_niedrig': 0,
    'nicht_einordenbar': 0
  };
  
  positionen.forEach(pos => {
    const status = toEvaluationLevel(pos.einordnung_stufe);
    counts[status]++;
  });
  
  return counts;
}

// Status Summary component
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

export function MultiDocumentAnalysisView({ analysisData, onRequestPDF, onClose }: MultiDocumentAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState('doc-0');
  
  const successfulDocs = useMemo(() => 
    analysisData.documents.filter(d => d.status === 'success'),
    [analysisData.documents]
  );

  // Get current quarter
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  // Overall stats
  const overallStats = useMemo(() => {
    const counts: Record<EvaluationLevel, number> = {
      'im_regionalen_rahmen': 0,
      'leicht_ueber_vergleich': 0,
      'auffaellig_hoch': 0,
      'auffaellig_niedrig': 0,
      'nicht_einordenbar': 0
    };

    successfulDocs.forEach(doc => {
      doc.positionen?.forEach(pos => {
        const status = toEvaluationLevel(pos.einordnung_stufe);
        counts[status]++;
      });
    });

    return counts;
  }, [successfulDocs]);

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background">
        {/* Header with navigation */}
        <Header onUploadClick={onClose} />
        
        {/* Secondary navigation */}
        <div className="sticky top-16 z-10 bg-background/95 backdrop-blur border-b">
          <div className="container max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={handleBackToHome} className="gap-2">
                  <Home className="w-4 h-4" />
                  Zur Startseite
                </Button>
                <div className="h-4 w-px bg-border" />
                <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Neue Analyse
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm flex items-center gap-2">
                  {analysisData.documentCount} Dokument{analysisData.documentCount !== 1 ? 'e' : ''} analysiert
                  {(analysisData.plz || analysisData.stadt) && (
                    <>
                      <span>•</span>
                      <MapPin className="w-3.5 h-3.5" />
                      {[analysisData.plz, analysisData.stadt].filter(Boolean).join(' ')}
                    </>
                  )}
                </p>
                <Button onClick={onRequestPDF} size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  PDF-Report
                  <Badge variant="secondary" className="ml-1">2,99€</Badge>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-6xl mx-auto px-4 py-8">
          {/* Tabs for Documents */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              {successfulDocs.map((doc, i) => (
                <TabsTrigger key={doc.documentIndex} value={`doc-${i}`} className="gap-2">
                  <FileText className="w-4 h-4" />
                  {successfulDocs.length === 1 ? 'Einzelanalyse' : `Dok. ${i + 1}`}
                </TabsTrigger>
              ))}
              {successfulDocs.length > 1 && (
                <TabsTrigger value="comparison" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Vergleich
                </TabsTrigger>
              )}
            </TabsList>

            {/* Document Tabs with Table Layout */}
            {successfulDocs.map((doc, i) => {
              const docCounts = getStatusCounts(doc.positionen || []);
              
              return (
                <TabsContent key={doc.documentIndex} value={`doc-${i}`}>
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-semibold">
                            Angebot: {doc.service_domain || doc.fileName || 'Handwerkerleistung'}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {(analysisData.stadt || analysisData.plz) && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {[analysisData.plz, analysisData.stadt].filter(Boolean).join(' ')}
                              </div>
                            )}
                            {doc.handwerker_firma && (
                              <span>• {doc.handwerker_firma}</span>
                            )}
                            {doc.handwerker_name && !doc.handwerker_firma && (
                              <span>• {doc.handwerker_name}</span>
                            )}
                          </div>
                        </div>
                        <StatusSummary counts={docCounts} />
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {/* AI Summary */}
                      {doc.analysis_summary && (
                        <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                            <div>
                              <h4 className="font-medium text-sm mb-1">KI-Einschätzung</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {doc.analysis_summary}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[50%]">Position</TableHead>
                              <TableHead className="text-right">Menge</TableHead>
                              <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {doc.positionen?.map((pos, j) => {
                              const status = toEvaluationLevel(pos.einordnung_stufe);
                              const hasDetails = pos.einordnung_begruendung || pos.marktpreis_durchschnitt || pos.hinweis || pos.datengrundlage;
                              
                              return (
                                <TableRow key={j} className="hover:bg-muted/30">
                                  <TableCell className="font-medium">
                                    {pos.beschreibung}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {pos.menge != null ? `${pos.menge} ${pos.einheit || ''}`.trim() : '–'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-2">
                                      <StatusBadge status={status} size="sm" />
                                      {hasDetails && (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button className="p-1 rounded-full hover:bg-muted/50 transition-colors">
                                              <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent 
                                            side="left" 
                                            className="max-w-xs p-3 space-y-2"
                                          >
                                            {pos.einordnung_begruendung && (
                                              <p className="text-sm">{pos.einordnung_begruendung}</p>
                                            )}
                                            {pos.marktpreis_durchschnitt && (
                                              <div className="text-xs text-muted-foreground space-y-0.5">
                                                <p>
                                                  Regionaler Vergleichswert: {pos.marktpreis_durchschnitt.toLocaleString('de-DE')}€
                                                </p>
                                                {pos.marktpreis_min != null && pos.marktpreis_max != null && (
                                                  <p className="text-muted-foreground/80">
                                                    Spannbreite: {pos.marktpreis_min.toLocaleString('de-DE')}–{pos.marktpreis_max.toLocaleString('de-DE')}€
                                                  </p>
                                                )}
                                                {pos.abweichung_prozent != null && (
                                                  <p>
                                                    Abweichung: {pos.abweichung_prozent > 0 ? '+' : ''}{pos.abweichung_prozent.toFixed(0)}%
                                                  </p>
                                                )}
                                              </div>
                                            )}
                                            {pos.hinweis && pos.hinweis !== 'Keine weiteren Hinweise' && (
                                              <p className="text-xs italic text-muted-foreground border-t border-border pt-2">
                                                💡 {pos.hinweis}
                                              </p>
                                            )}
                                            {pos.datengrundlage && (
                                              <p className="text-xs text-muted-foreground/70 border-t border-border pt-2">
                                                📊 {getDataSourceDisplay(pos.datengrundlage, pos.datenquelle)}
                                              </p>
                                            )}
                                            {pos.confidence && (
                                              <div className="text-xs border-t border-border pt-2 flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${
                                                  pos.confidence.level === 'hoch' 
                                                    ? 'bg-green-500' 
                                                    : pos.confidence.level === 'mittel' 
                                                    ? 'bg-yellow-500' 
                                                    : 'bg-gray-400'
                                                }`} />
                                                <span className="text-muted-foreground">
                                                  {pos.confidence.reason}
                                                </span>
                                              </div>
                                            )}
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-3">
                        {doc.positionen?.map((pos, j) => {
                          const status = toEvaluationLevel(pos.einordnung_stufe);
                          return (
                            <div key={j} className="p-3 rounded-lg border bg-card">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-medium text-sm">{pos.beschreibung}</p>
                                <StatusBadge status={status} size="sm" />
                              </div>
                              {pos.menge != null && (
                                <p className="text-xs text-muted-foreground">
                                  {pos.menge} {pos.einheit || ''}
                                </p>
                              )}
                              {pos.einordnung_begruendung && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {pos.einordnung_begruendung}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary footer */}
                      {doc.gesamtpreis && (
                        <div className="mt-6 pt-4 border-t flex items-center justify-between">
                          <span className="font-medium">Gesamtpreis</span>
                          <span className="text-xl font-bold">
                            {doc.gesamtpreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}

            {/* Comparison Tab */}
            {successfulDocs.length > 1 && (
              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Vergleichsübersicht
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {successfulDocs.map((doc, i) => {
                        const counts = getStatusCounts(doc.positionen || []);
                        return (
                          <div key={i} className="p-4 rounded-lg border">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">{doc.fileName}</h4>
                              <span className="font-bold">
                                {doc.gesamtpreis?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || '–'}
                              </span>
                            </div>
                            <StatusSummary counts={counts} />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* CTA for PDF */}
          <Card className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Detaillierter PDF-Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Vollständige Analyse mit Marktpreisen, Begründungen und Empfehlungen
                    </p>
                  </div>
                </div>
                <Button onClick={onRequestPDF} className="gap-2">
                  <Download className="w-4 h-4" />
                  PDF kaufen
                  <Badge variant="secondary">2,99€</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
