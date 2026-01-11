import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, Image, Loader2, X } from "lucide-react";

interface GuestUploadModalProps {
  open: boolean;
  onClose: () => void;
  onAnalysisComplete: (analysis: GuestAnalysisResult) => void;
}

export interface GuestAnalysisResult {
  positionen: Array<{
    beschreibung: string;
    material?: string;
    menge?: number;
    einheit?: string;
    einzelpreis?: number;
    gesamtpreis?: number;
    status: "green" | "yellow" | "red";
    plausibility_score: number;
    hinweis: string;
    marktpreis_min?: number;
    marktpreis_max?: number;
    marktpreis_durchschnitt?: number;
    abweichung_prozent?: number;
    gewerk_name?: string;
  }>;
  gesamtpreis: number;
  plausibility_score: number;
  analysis_summary: string;
  handwerker_firma?: string;
  titel?: string;
}

type UploadStep = "upload" | "processing" | "analyzing";

export function GuestUploadModal({ open, onClose, onAnalysisComplete }: GuestUploadModalProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [stadt, setStadt] = useState("");
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setTitle("");
    setStadt("");
    setProgress(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte laden Sie eine PDF, JPG oder PNG Datei hoch.",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Die Datei darf maximal 10 MB groß sein.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
    if (!title) {
      setTitle(fileName);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!file || !title.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte wählen Sie eine Datei und geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStep("processing");
      setProgress(20);

      // Convert file to base64 for the edge function
      const base64File = await fileToBase64(file);
      
      setProgress(40);
      setStep("analyzing");

      console.log("Sending file for analysis:", { 
        fileName: file.name, 
        fileType: file.type, 
        fileSize: file.size,
        hasBase64: !!base64File
      });
      
      // Call analyze function without angebotId (guest mode)
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-angebot",
        {
          body: {
            // No angebotId = guest mode, no DB storage
            extractedText: `Angebot: ${title}\nStadt: ${stadt || "Deutschland"}`,
            fileBase64: base64File,
            fileType: file.type,
            guestMode: true,
          },
        }
      );

      setProgress(100);

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        throw new Error("Analyse fehlgeschlagen");
      }

      if (analysisData?.analysis) {
        // Store analysis in localStorage for persistence
        const guestAnalysis = {
          ...analysisData.analysis,
          titel: title,
          stadt: stadt,
          fileName: file.name,
          analyzedAt: new Date().toISOString(),
        };
        localStorage.setItem("guestAnalysis", JSON.stringify(guestAnalysis));
        
        toast({
          title: "Analyse abgeschlossen!",
          description: "Ihre kostenlose Analyse ist fertig.",
        });
        
        onAnalysisComplete(analysisData.analysis);
        resetState();
      } else {
        throw new Error("Keine Analysedaten erhalten");
      }

    } catch (error) {
      console.error("Guest upload error:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
      setStep("upload");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Angebot kostenlos prüfen"}
            {step === "processing" && "Wird vorbereitet..."}
            {step === "analyzing" && "KI analysiert..."}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Laden Sie ein Handwerker-Angebot hoch – ohne Anmeldung"}
            {step === "processing" && "Ihre Datei wird vorbereitet"}
            {step === "analyzing" && "Unsere KI prüft Ihr Angebot"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {/* File Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer text-center ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : file
                  ? "border-status-green bg-status-green-bg"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  {file.type.startsWith("image/") ? (
                    <Image className="w-8 h-8 text-status-green" />
                  ) : (
                    <FileText className="w-8 h-8 text-status-green" />
                  )}
                  <div className="text-left">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-foreground mb-1">
                    Datei hier ablegen oder klicken
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF, JPG oder PNG (max. 10 MB)
                  </p>
                </>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="guest-title">Bezeichnung *</Label>
              <Input
                id="guest-title"
                placeholder="z.B. Renovierung Bad"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* City Input */}
            <div className="space-y-2">
              <Label htmlFor="guest-stadt">Stadt (optional)</Label>
              <Input
                id="guest-stadt"
                placeholder="z.B. München"
                value={stadt}
                onChange={(e) => setStadt(e.target.value)}
              />
            </div>

            <div className="bg-accent/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">✨ Kostenlose Analyse</p>
              <p>Sie erhalten eine Basis-Bewertung mit Ampelsystem. Für PDF-Export und Speichern ist eine Registrierung erforderlich.</p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!file || !title.trim()}
              className="w-full"
              size="lg"
            >
              Jetzt kostenlos analysieren
            </Button>
          </div>
        )}

        {(step === "processing" || step === "analyzing") && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {step === "processing"
                ? "Datei wird vorbereitet..."
                : "KI analysiert Ihr Angebot..."}
            </p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
