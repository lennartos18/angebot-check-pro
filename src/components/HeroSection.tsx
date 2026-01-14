import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield, UserX, Eye } from "lucide-react";

interface HeroSectionProps {
  onUploadClick?: () => void;
}

const trustBadges = [
  { icon: Shield, text: "100% DSGVO-konform" },
  { icon: UserX, text: "Keine Registrierung" },
  { icon: Eye, text: "Anonymisiert" },
];

export function HeroSection({ onUploadClick }: HeroSectionProps) {
  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[85vh] flex items-center pt-20 overflow-hidden bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            {trustBadges.map((badge, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium"
              >
                <badge.icon className="h-4 w-4" />
                {badge.text}
              </div>
            ))}
          </motion.div>

          {/* Headline */}
          <div className="space-y-6 mb-10">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-sm font-semibold text-primary uppercase tracking-wide"
            >
              Für Handwerker-Angebote & KFZ-Werkstatt-Rechnungen
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
            >
              Angebot erhalten?{" "}
              <span className="text-primary">
                Sofort prüfen
              </span>
              , ob der Preis fair ist.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Egal ob Dachdecker, Elektriker, Sanitär oder Ihre KFZ-Werkstatt – 
              laden Sie bis zu 3 Angebote hoch und sehen Sie sofort, welche Positionen auffällig sind.
            </motion.p>
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row justify-center gap-4 mb-8"
          >
            <Button
              size="lg"
              onClick={onUploadClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Angebote hochladen
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToDemo}
              className="text-lg px-8 py-6 rounded-xl"
            >
              Demo ansehen
            </Button>
          </motion.div>

          {/* Supported Formats */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-muted-foreground"
          >
            Unterstützte Formate: PDF, JPG, PNG, Excel • Max. 10 MB pro Datei
          </motion.p>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
    </section>
  );
}
