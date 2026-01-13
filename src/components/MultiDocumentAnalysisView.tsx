import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  CheckCircle,
  BarChart3,
  Download,
  Lock,
  Info,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Position {
  beschreibung: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  einordnung_stufe?: string;
  einordnung_begruendung?: string;
  abweichung_prozent?: number;
  datengrundlage?: string;
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

const getEinordnungColor = (stufe?: string): string => {
  switch (stufe?.toLowerCase()) {
    case 'im regionalen rahmen':
    case 'im_regionalen_rahmen':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'leicht über dem vergleich':
    case 'leicht_ueber_vergleich':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'auffällig hoch':
    case 'auffaellig_hoch':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'auffällig niedrig':
    case 'auffaellig_niedrig':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getEinordnungLabel = (stufe?: string): string => {
  switch (stufe?.toLowerCase()) {
    case 'im regionalen rahmen':
    case 'im_regionalen_rahmen':
      return 'Im regionalen Rahmen';
    case 'leicht über dem vergleich':
    case 'leicht_ueber_vergleich':
      return 'Leicht über Vergleich';
    case 'auffällig hoch':
    case 'auffaellig_hoch':
      return 'Auffällig hoch';
    case 'auffällig niedrig':
    case 'auffaellig_niedrig':
      return 'Auffällig niedrig';
    default:
      return 'Nicht einordenbar';
  }
};

export function MultiDocumentAnalysisView({ analysisData, onRequestPDF, onClose }: MultiDocumentAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const successfulDocs = useMemo(() => 
    analysisData.documents.filter(d => d.status === 'success'),
    [analysisData.documents]
  );

  // Calculate comparison data
  const comparisonData = useMemo(() => {
    if (successfulDocs.length < 2) return null;

    // Find common positions across documents
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

    // Filter for positions that appear in multiple documents
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

    return {
      commonPositions,
      totalPositions: successfulDocs.reduce((sum, doc) => sum + (doc.positionen?.length || 0), 0)
    };
  }, [successfulDocs]);

  const overallStats = useMemo(() => {
    const stats = {
      imRahmen: 0,
      leichtUeber: 0,
      auffaelligHoch: 0,
      auffaelligNiedrig: 0,
      nichtEinordenbar: 0,
      total: 0
    };

    successfulDocs.forEach(doc => {
      doc.positionen?.forEach(pos => {
        stats.total++;
        const stufe = pos.einordnung_stufe?.toLowerCase();
        if (stufe?.includes('rahmen')) stats.imRahmen++;
        else if (stufe?.includes('leicht')) stats.leichtUeber++;
        else if (stufe?.includes('hoch')) stats.auffaelligHoch++;
        else if (stufe?.includes('niedrig')) stats.auffaelligNiedrig++;
        else stats.nichtEinordenbar++;
      });
    });

    return stats;
  }, [successfulDocs]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="container max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Analyse-Ergebnis</h1>
                <p className="text-muted-foreground">
                  {analysisData.documentCount} Dokument{analysisData.documentCount !== 1 ? 'e' : ''} analysiert
                  {analysisData.plz && ` • Region: ${analysisData.plz}`}
                  {analysisData.stadt && ` ${analysisData.stadt}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onClose}>
                  Neue Analyse
                </Button>
                <Button onClick={onRequestPDF} className="gap-2">
                  <Download className="w-4 h-4" />
                  Detail-PDF
                  <Badge variant="secondary" className="ml-1">2,99€</Badge>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-6xl mx-auto px-4 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{overallStats.imRahmen}</div>
                <div className="text-sm text-green-600/80">Im Rahmen</div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{overallStats.leichtUeber}</div>
                <div className="text-sm text-yellow-600/80">Leicht über</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{overallStats.auffaelligHoch}</div>
                <div className="text-sm text-red-600/80">Auffällig hoch</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{overallStats.auffaelligNiedrig}</div>
                <div className="text-sm text-blue-600/80">Auffällig niedrig</div>
              </CardContent>
            </Card>
            <Card className="border-gray-200 bg-gray-50/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-600">{overallStats.nichtEinordenbar}</div>
                <div className="text-sm text-gray-600/80">Nicht einordenbar</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Übersicht
              </TabsTrigger>
              {successfulDocs.map((doc, i) => (
                <TabsTrigger key={doc.documentIndex} value={`doc-${i}`} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Dok. {i + 1}
                </TabsTrigger>
              ))}
              {successfulDocs.length > 1 && (
                <TabsTrigger value="comparison" className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Vergleich
                </TabsTrigger>
              )}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {successfulDocs.map((doc, i) => (
                <Card key={doc.documentIndex}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{doc.fileName}</CardTitle>
                          <CardDescription>
                            {doc.positionen?.length || 0} Positionen
                            {doc.service_domain && ` • ${doc.service_domain}`}
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab(`doc-${i}`)}>
                        Details →
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {doc.positionen?.slice(0, 5).map((pos, j) => (
                        <Badge 
                          key={j} 
                          variant="outline"
                          className={getEinordnungColor(pos.einordnung_stufe)}
                        >
                          {pos.beschreibung.slice(0, 30)}{pos.beschreibung.length > 30 ? '...' : ''}
                        </Badge>
                      ))}
                      {(doc.positionen?.length || 0) > 5 && (
                        <Badge variant="secondary">
                          +{(doc.positionen?.length || 0) - 5} weitere
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Document Detail Tabs */}
            {successfulDocs.map((doc, i) => (
              <TabsContent key={doc.documentIndex} value={`doc-${i}`} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {doc.fileName}
                    </CardTitle>
                    {doc.handwerker_name && (
                      <CardDescription>{doc.handwerker_name}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {doc.positionen?.map((pos, j) => (
                      <div key={j} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{pos.beschreibung}</span>
                              <Badge 
                                variant="outline" 
                                className={getEinordnungColor(pos.einordnung_stufe)}
                              >
                                {getEinordnungLabel(pos.einordnung_stufe)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {pos.menge && (
                                <span>{pos.menge} {pos.einheit}</span>
                              )}
                              {pos.abweichung_prozent !== undefined && pos.abweichung_prozent !== 0 && (
                                <span className={pos.abweichung_prozent > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {pos.abweichung_prozent > 0 ? '+' : ''}{pos.abweichung_prozent.toFixed(0)}% vom Vergleich
                                </span>
                              )}
                            </div>
                            {pos.einordnung_begruendung && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                {pos.einordnung_begruendung}
                              </p>
                            )}
                          </div>
                          {pos.datengrundlage && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-4 h-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{pos.datengrundlage}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}

            {/* Comparison Tab */}
            {successfulDocs.length > 1 && (
              <TabsContent value="comparison" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Dokumentenvergleich
                    </CardTitle>
                    <CardDescription>
                      Relative Abweichungen zwischen den Dokumenten
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comparisonData && comparisonData.commonPositions.length > 0 ? (
                      <div className="space-y-4">
                        {comparisonData.commonPositions.map((item, i) => (
                          <div key={i} className="p-4 rounded-lg border">
                            <p className="font-medium mb-3">{item.beschreibung}</p>
                            <div className="flex gap-4">
                              {item.documents.map((docData, j) => (
                                <div 
                                  key={j}
                                  className={`flex-1 p-3 rounded-lg ${getEinordnungColor(docData.einordnung)}`}
                                >
                                  <p className="text-sm font-medium">
                                    Dokument {docData.docIndex + 1}
                                  </p>
                                  <p className="text-xs opacity-70">
                                    {getEinordnungLabel(docData.einordnung)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Keine vergleichbaren Positionen gefunden.</p>
                        <p className="text-sm">Die Dokumente enthalten unterschiedliche Leistungen.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Premium Teaser */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">Detailliertes PDF-Reporting</h3>
                        <p className="text-muted-foreground mb-4">
                          Erhalten Sie Quartile, Median, Spannbreiten und grafische Visualisierungen 
                          für jede Position. Inklusive Vergleich aller Dokumente.
                        </p>
                        <ul className="grid grid-cols-2 gap-2 text-sm mb-4">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Quartil-Analyse
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Grafische Darstellung
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Dokumenten-Vergleich
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Sofortiger Download
                          </li>
                        </ul>
                        <Button onClick={onRequestPDF} className="gap-2">
                          <Download className="w-4 h-4" />
                          PDF freischalten
                          <Badge variant="secondary" className="ml-1">2,99€</Badge>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
