import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  BarChart3,
  Download,
  Lock,
  Info,
  MapPin,
  ArrowLeft
} from 'lucide-react';
import { StatusBadge, EvaluationLevel } from './StatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  marktpreis_min?: number;
  marktpreis_max?: number;
  marktpreis_durchschnitt?: number;
  hinweis?: string;
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

  // Comparison data for multiple documents
  const comparisonData = useMemo(() => {
    if (successfulDocs.length < 2) return null;

    const allPositions: Map<string, { doc: number; position: Position }[]> = new Map();
    
    successfulDocs.forEach((doc, docIndex) => {
      doc.positionen?.forEach(pos => {
        const key = pos.beschreibung.toLowerCase().trim().slice(0, 50);
        if (!allPositions.has(key)) {
          allPositions.set(key, []);
        }
        allPositions.get(key)!.push({ doc: docIndex, position: pos });
      });
    });

    const commonPositions = Array.from(allPositions.entries())
      .filter(([_, docs]) => docs.length > 1)
      .map(([key, docs]) => ({
        beschreibung: docs[0].position.beschreibung,
        documents: docs.map(d => ({
          docIndex: d.doc,
          gesamtpreis: d.position.gesamtpreis,
          einordnung: d.position.einordnung_stufe
        }))
      }));

    return { commonPositions };
  }, [successfulDocs]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="container max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Analyse-Ergebnis</h1>
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
                </div>
              </div>
              <Button onClick={onRequestPDF} className="gap-2">
                <Download className="w-4 h-4" />
                PDF-Report
                <Badge variant="secondary" className="ml-1">2,99€</Badge>
              </Button>
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
                      {/* Desktop Table */}
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
                            {doc.positionen?.map((pos, j) => {
                              const status = toEvaluationLevel(pos.einordnung_stufe);
                              const hasDetails = pos.einordnung_begruendung || pos.marktpreis_durchschnitt || pos.hinweis || pos.datengrundlage;
                              
                              return (
                                <TableRow key={j} className="hover:bg-muted/30">
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
                                              <p className="text-xs italic text-muted-foreground border-t border-border pt-2">
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

                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-3">
                        {doc.positionen?.map((pos, j) => {
                          const status = toEvaluationLevel(pos.einordnung_stufe);
                          const hasDetails = pos.einordnung_begruendung || pos.marktpreis_durchschnitt || pos.hinweis;
                          
                          return (
                            <div 
                              key={j} 
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
                          Basierend auf regionalen Vergleichspositionen
                          {analysisData.stadt && `, Region ${analysisData.stadt}`}
                          {analysisData.plz && !analysisData.stadt && `, PLZ ${analysisData.plz}`}
                          {', '}
                          {quarter}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary Stats below */}
                  {(doc.gesamtpreis || doc.plausibility_score) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      {doc.plausibility_score != null && (
                        <Card className="p-3 border">
                          <div className="text-xs text-muted-foreground mb-1">Plausibilität</div>
                          <div className={`text-xl font-bold ${
                            doc.plausibility_score >= 75 ? 'text-green-600' : 
                            doc.plausibility_score >= 50 ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {doc.plausibility_score}%
                          </div>
                        </Card>
                      )}
                      {doc.gesamtpreis != null && (
                        <Card className="p-3 border">
                          <div className="text-xs text-muted-foreground mb-1">Gesamtpreis</div>
                          <div className="text-xl font-bold">
                            {doc.gesamtpreis.toLocaleString('de-DE')}€
                          </div>
                        </Card>
                      )}
                      <Card className="p-3 border">
                        <div className="text-xs text-muted-foreground mb-1">Positionen</div>
                        <div className="text-xl font-bold">{doc.positionen?.length || 0}</div>
                      </Card>
                      {doc.service_domain && (
                        <Card className="p-3 border">
                          <div className="text-xs text-muted-foreground mb-1">Gewerk</div>
                          <div className="text-lg font-bold truncate">{doc.service_domain}</div>
                        </Card>
                      )}
                    </div>
                  )}
                </TabsContent>
              );
            })}

            {/* Comparison Tab */}
            {successfulDocs.length > 1 && (
              <TabsContent value="comparison">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <CardTitle className="text-lg">Vergleich: {successfulDocs.length} Angebote</CardTitle>
                      <StatusSummary counts={overallStats} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {comparisonData && comparisonData.commonPositions.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[40%]">Position</TableHead>
                                {successfulDocs.map((_, i) => (
                                  <TableHead key={i} className="text-center">Angebot {String.fromCharCode(65 + i)}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comparisonData.commonPositions.map((item, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-medium">{item.beschreibung}</TableCell>
                                  {successfulDocs.map((_, docIdx) => {
                                    const docData = item.documents.find(d => d.docIndex === docIdx);
                                    if (!docData) return <TableCell key={docIdx} className="text-center text-muted-foreground">–</TableCell>;
                                    const status = toEvaluationLevel(docData.einordnung);
                                    return (
                                      <TableCell key={docIdx} className="text-center">
                                        <StatusBadge status={status} size="sm" />
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Overall comparison summary */}
                        <div className="mt-6 pt-4 border-t">
                          <p className="text-sm font-medium mb-3">Gesamtbewertung</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {successfulDocs.map((doc, i) => {
                              const docCounts = getStatusCounts(doc.positionen || []);
                              const total = doc.positionen?.length || 1;
                              const goodPercent = Math.round((docCounts.im_regionalen_rahmen / total) * 100);
                              
                              return (
                                <div 
                                  key={i}
                                  className={`rounded-lg p-4 text-center border ${
                                    goodPercent >= 70 ? 'bg-green-50 border-green-200' :
                                    goodPercent >= 40 ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-red-50 border-red-200'
                                  }`}
                                >
                                  <div className={`text-lg font-bold ${
                                    goodPercent >= 70 ? 'text-green-700' :
                                    goodPercent >= 40 ? 'text-yellow-700' :
                                    'text-red-700'
                                  }`}>
                                    Angebot {String.fromCharCode(65 + i)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {goodPercent}% im Rahmen
                                  </div>
                                  {doc.gesamtpreis && (
                                    <div className="text-sm font-medium mt-1">
                                      {doc.gesamtpreis.toLocaleString('de-DE')}€
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Keine vergleichbaren Positionen gefunden.</p>
                        <p className="text-sm">Die Dokumente enthalten unterschiedliche Leistungen.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Premium CTA */}
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Detaillierten PDF-Report erhalten</h4>
                    <p className="text-sm text-muted-foreground">
                      Inkl. Quartil-Analyse, Marktdaten-Visualisierung & Empfehlungen
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button onClick={onRequestPDF} className="flex-1 sm:flex-none gap-2">
                    <Download className="h-4 w-4" />
                    PDF freischalten
                    <Badge variant="secondary" className="ml-1">2,99€</Badge>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
