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
import { Upload, FileText, Image, Loader2, X, CheckCircle } from "lucide-react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStep = "upload" | "processing" | "analyzing" | "complete";

export function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
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
    // Auto-set title from filename
    const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
    if (!title) {
      setTitle(fileName);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStep("processing");
      setProgress(10);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Nicht angemeldet");
      }

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      setProgress(20);

      const { error: uploadError } = await supabase.storage
        .from("angebote-uploads")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Datei-Upload fehlgeschlagen");
      }

      setProgress(40);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("angebote-uploads")
        .getPublicUrl(fileName);

      // Create angebot entry
      const { data: angebot, error: insertError } = await supabase
        .from("angebote")
        .insert({
          user_id: user.id,
          title: title.trim(),
          stadt: stadt.trim() || null,
          original_file_url: urlData.publicUrl,
          original_file_name: file.name,
          status: "analyzing",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Angebot konnte nicht erstellt werden");
      }

      setProgress(60);
      setStep("analyzing");

      // Call analyze function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-angebot",
        {
          body: {
            angebotId: angebot.id,
            extractedText: `Angebot: ${title}\nStadt: ${stadt || "Deutschland"}\nDateiname: ${file.name}`,
          },
        }
      );

      setProgress(100);

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        // Update status to error
        await supabase
          .from("angebote")
          .update({ status: "error" })
          .eq("id", angebot.id);
        
        toast({
          title: "Analyse teilweise fehlgeschlagen",
          description: "Das Angebot wurde gespeichert, konnte aber nicht vollständig analysiert werden.",
          variant: "destructive",
        });
      } else {
        setStep("complete");
      }

      setTimeout(() => {
        toast({
          title: "Angebot hochgeladen!",
          description: "Die Analyse wurde erfolgreich durchgeführt.",
        });
        onSuccess();
        resetState();
      }, 1500);

    } catch (error) {
      console.error("Upload process error:", error);
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
            {step === "upload" && "Angebot hochladen"}
            {step === "processing" && "Wird hochgeladen..."}
            {step === "analyzing" && "Wird analysiert..."}
            {step === "complete" && "Analyse abgeschlossen!"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Laden Sie ein Handwerker-Angebot als PDF oder Foto hoch"}
            {step === "processing" && "Ihre Datei wird hochgeladen"}
            {step === "analyzing" && "KI analysiert Ihr Angebot"}
            {step === "complete" && "Ihr Angebot wurde erfolgreich analysiert"}
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
              <Label htmlFor="title">Bezeichnung *</Label>
              <Input
                id="title"
                placeholder="z.B. Renovierung Bad"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* City Input */}
            <div className="space-y-2">
              <Label htmlFor="stadt">Stadt (optional)</Label>
              <Input
                id="stadt"
                placeholder="z.B. München"
                value={stadt}
                onChange={(e) => setStadt(e.target.value)}
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !title.trim()}
              className="w-full"
              size="lg"
            >
              Angebot analysieren
            </Button>
          </div>
        )}

        {(step === "processing" || step === "analyzing") && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {step === "processing"
                ? "Datei wird hochgeladen..."
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

        {step === "complete" && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-status-green mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">
              Analyse abgeschlossen!
            </p>
            <p className="text-muted-foreground">
              Sie werden zur Detailansicht weitergeleitet...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}