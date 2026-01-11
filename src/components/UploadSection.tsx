import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image, ArrowRight } from "lucide-react";
import { useState, useRef } from "react";

interface UploadSectionProps {
  onUploadClick?: () => void;
}

export function UploadSection({ onUploadClick }: UploadSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Trigger upload modal when file is dropped
    if (onUploadClick) {
      onUploadClick();
    }
  };

  const handleClick = () => {
    if (onUploadClick) {
      onUploadClick();
    }
  };

  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Jetzt Angebot prüfen
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Laden Sie Ihr Handwerker-Angebot hoch und erhalten Sie sofort eine erste Bewertung
          </p>

          {/* Upload Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div
              onClick={handleClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 transition-all cursor-pointer ${
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  isDragOver ? "bg-primary/20" : "bg-muted"
                }`}>
                  <Upload className={`w-8 h-8 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                
                <div>
                  <p className="font-semibold text-foreground mb-1">
                    Datei hier ablegen oder klicken
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF, JPG oder PNG (max. 10 MB)
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    PDF
                  </span>
                  <span className="flex items-center gap-1">
                    <Image className="w-4 h-4" />
                    Foto
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Alternative CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="hero" size="lg" className="group" onClick={onUploadClick}>
              Angebot analysieren
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Erste Analyse kostenlos
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
