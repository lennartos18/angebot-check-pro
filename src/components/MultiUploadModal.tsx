import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, X, FileText, Image, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Clock, Wrench, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGuestSession, GuestDocument } from '@/hooks/useGuestSession';
import { supabase } from '@/integrations/supabase/client';

interface MultiUploadModalProps {
  open: boolean;
  onClose: () => void;
  onAnalysisComplete: (results: any) => void;
}

interface FileWithProgress {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

type DocumentCategory = 'handwerk' | 'kfz';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const getFileIcon = (type: string) => {
  if (type.includes('pdf')) return FileText;
  if (type.includes('image')) return Image;
  if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet')) return FileSpreadsheet;
  return FileText;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MultiUploadModal({ open, onClose, onAnalysisComplete }: MultiUploadModalProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [plz, setPlz] = useState('');
  const [stadt, setStadt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [category, setCategory] = useState<DocumentCategory>('handwerk');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { session, addDocument, updateLocation, updateAnalysis } = useGuestSession();

  const resetState = useCallback(() => {
    setFiles([]);
    setPlz('');
    setStadt('');
    setIsAnalyzing(false);
    setOverallProgress(0);
    setCurrentStep('');
    setIsDragOver(false);
    setCategory('handwerk');
  }, []);

  const handleClose = useCallback(() => {
    if (isAnalyzing) return;
    resetState();
    onClose();
  }, [isAnalyzing, resetState, onClose]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: Ungültiger Dateityp. Erlaubt sind PDF, JPG, PNG, CSV, Excel.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: Datei zu groß. Maximum: 10 MB.`;
    }
    return null;
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const currentCount = files.length;
    const availableSlots = MAX_FILES - currentCount;

    if (availableSlots <= 0) {
      toast({
        title: "Maximum erreicht",
        description: `Sie können maximal ${MAX_FILES} Dokumente hochladen.`,
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = newFiles.slice(0, availableSlots);
    const errors: string[] = [];
    const validFiles: FileWithProgress[] = [];

    filesToAdd.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        // Check for duplicates
        const isDuplicate = files.some(f => f.file.name === file.name && f.file.size === file.size);
        if (isDuplicate) {
          errors.push(`${file.name}: Datei bereits hinzugefügt.`);
        } else {
          validFiles.push({
            id: crypto.randomUUID(),
            file,
            progress: 0,
            status: 'pending'
          });
        }
      }
    });

    if (errors.length > 0) {
      toast({
        title: "Einige Dateien wurden nicht hinzugefügt",
        description: errors.join('\n'),
        variant: "destructive"
      });
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }

    if (newFiles.length > availableSlots) {
      toast({
        title: "Hinweis",
        description: `Nur ${availableSlots} von ${newFiles.length} Dateien wurden hinzugefügt (Maximum: ${MAX_FILES}).`,
      });
    }
  }, [files, validateFile, toast]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addFiles]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const analyzeDocuments = async () => {
    if (files.length === 0) {
      toast({
        title: "Keine Dokumente",
        description: "Bitte laden Sie mindestens ein Dokument hoch.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setOverallProgress(0);
    
    try {
      // Update location in session
      if (plz || stadt) {
        await updateLocation(plz, stadt);
      }

      const results: any[] = [];
      const totalSteps = files.length * 3; // convert, extract, analyze per file
      let completedSteps = 0;

      for (let i = 0; i < files.length; i++) {
        const fileWithProgress = files[i];
        const file = fileWithProgress.file;
        
        // Update file status
        setFiles(prev => prev.map(f => 
          f.id === fileWithProgress.id ? { ...f, status: 'uploading' as const, progress: 10 } : f
        ));
        setCurrentStep(`Dokument ${i + 1}/${files.length}: Wird konvertiert...`);

        // Convert to base64
        const base64 = await fileToBase64(file);
        completedSteps++;
        setOverallProgress((completedSteps / totalSteps) * 100);
        
        setFiles(prev => prev.map(f => 
          f.id === fileWithProgress.id ? { ...f, status: 'processing' as const, progress: 40 } : f
        ));
        setCurrentStep(`Dokument ${i + 1}/${files.length}: Wird analysiert...`);

        // Call analyze function
        const { data, error } = await supabase.functions.invoke('analyze-angebot', {
          body: {
            fileBase64: base64,
            fileType: file.type,
            plz: plz || undefined,
            stadt: stadt || undefined,
            guestMode: true,
            documentIndex: i,
            totalDocuments: files.length,
            category: category // Pass category to backend
          }
        });

        completedSteps += 2;
        setOverallProgress((completedSteps / totalSteps) * 100);

        if (error) {
          console.error(`Error analyzing document ${i + 1}:`, error);
          setFiles(prev => prev.map(f => 
            f.id === fileWithProgress.id ? { ...f, status: 'error' as const, error: error.message } : f
          ));
          results.push({
            documentIndex: i,
            fileName: file.name,
            error: error.message,
            status: 'error'
          });
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileWithProgress.id ? { ...f, status: 'complete' as const, progress: 100 } : f
          ));
          
          // Add document to session
          const guestDoc: GuestDocument = {
            id: fileWithProgress.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'analyzed',
            analysisResult: data
          };
          await addDocument(guestDoc);

          results.push({
            documentIndex: i,
            fileName: file.name,
            ...data,
            status: 'success'
          });
        }
      }

      setCurrentStep('Analyse abgeschlossen!');
      
      // Save combined analysis
      const combinedAnalysis = {
        documents: results,
        analyzedAt: new Date().toISOString(),
        plz,
        stadt,
        documentCount: files.length
      };
      await updateAnalysis(combinedAnalysis);

      toast({
        title: "Analyse abgeschlossen",
        description: `${results.filter(r => r.status === 'success').length} von ${files.length} Dokumenten erfolgreich analysiert.`,
      });

      onAnalysisComplete(combinedAnalysis);
      handleClose();

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysefehler",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canStartAnalysis = files.length > 0 && !isAnalyzing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-primary" />
            Dokumente hochladen
          </DialogTitle>
          <DialogDescription>
            Laden Sie bis zu 3 Angebote, Kostenvoranschläge oder Rechnungen hoch.
            Die Analyse ist kostenlos und anonym.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Switch */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Um welche Art von Dokumenten handelt es sich?
            </Label>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 transition-colors ${category === 'handwerk' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <Wrench className="w-5 h-5" />
                <span>Handwerk</span>
              </div>
              
              <Switch
                checked={category === 'kfz'}
                onCheckedChange={(checked) => setCategory(checked ? 'kfz' : 'handwerk')}
                className="data-[state=checked]:bg-primary"
              />
              
              <div className={`flex items-center gap-2 transition-colors ${category === 'kfz' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <Car className="w-5 h-5" />
                <span>KFZ-Werkstatt</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {category === 'handwerk' 
                ? 'Für Angebote von Dachdeckern, Elektrikern, Sanitär, Malern, etc.' 
                : 'Für Rechnungen und Kostenvoranschläge von KFZ-Werkstätten'}
            </p>
          </div>

          {/* Session Timer */}
          {session && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4" />
              <span>Session gültig für 24 Stunden</span>
            </div>
          )}

          {/* Drop Zone */}
          {files.length < MAX_FILES && !isAnalyzing && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-200
                ${isDragOver 
                  ? 'border-primary bg-primary/5 scale-[1.02]' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-lg font-medium mb-1">
                {isDragOver ? 'Dateien hier ablegen' : 'Dateien hierher ziehen'}
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                oder klicken zum Auswählen
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">PDF</span>
                <span className="bg-muted px-2 py-1 rounded">JPG/PNG</span>
                <span className="bg-muted px-2 py-1 rounded">Excel/CSV</span>
                <span className="bg-muted px-2 py-1 rounded">Max. 10 MB</span>
              </div>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  Hochgeladene Dokumente ({files.length}/{MAX_FILES})
                </h4>
                {files.length < MAX_FILES && !isAnalyzing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Weitere hinzufügen
                  </Button>
                )}
              </div>

              {files.map((fileItem) => {
                const Icon = getFileIcon(fileItem.file.type);
                return (
                  <div
                    key={fileItem.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border
                      ${fileItem.status === 'error' ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/50'}
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center
                      ${fileItem.status === 'complete' ? 'bg-green-100 text-green-600' :
                        fileItem.status === 'error' ? 'bg-red-100 text-red-600' :
                        fileItem.status === 'processing' || fileItem.status === 'uploading' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'}
                    `}>
                      {fileItem.status === 'processing' || fileItem.status === 'uploading' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : fileItem.status === 'complete' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : fileItem.status === 'error' ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{fileItem.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(fileItem.file.size)}
                        {fileItem.status === 'error' && fileItem.error && (
                          <span className="text-destructive ml-2">• {fileItem.error}</span>
                        )}
                      </p>
                      {(fileItem.status === 'processing' || fileItem.status === 'uploading') && (
                        <Progress value={fileItem.progress} className="h-1 mt-2" />
                      )}
                    </div>

                    {!isAnalyzing && fileItem.status !== 'complete' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(fileItem.id)}
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Location Input */}
          {files.length > 0 && !isAnalyzing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">PLZ (optional)</label>
                <Input
                  value={plz}
                  onChange={(e) => setPlz(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="z.B. 50667"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stadt (optional)</label>
                <Input
                  value={stadt}
                  onChange={(e) => setStadt(e.target.value)}
                  placeholder="z.B. Köln"
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Die Ortsangabe ermöglicht eine genauere regionale Einordnung der Preise.
              </p>
            </div>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-lg font-medium">{currentStep}</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {Math.round(overallProgress)}% abgeschlossen
              </p>
            </div>
          )}

          {/* Action Button */}
          {!isAnalyzing && (
            <Button
              onClick={analyzeDocuments}
              disabled={!canStartAnalysis}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {files.length === 0 ? (
                'Bitte Dokumente hochladen'
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  {files.length === 1 ? 'Dokument analysieren' : `${files.length} Dokumente analysieren`}
                  <span className="ml-2 text-primary-foreground/70">• Kostenlos</span>
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
