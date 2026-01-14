import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield, UserX, Eye, FileCheck, ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onUploadClick?: () => void;
}

const trustBadges = [
  { icon: Shield, text: "DSGVO-konform" },
  { icon: UserX, text: "Keine Registrierung" },
  { icon: Eye, text: "Anonymisiert" },
];

export function HeroSection({ onUploadClick }: HeroSectionProps) {
  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden bg-[hsl(var(--hero-bg))]">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-2"
            >
              {trustBadges.map((badge, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium"
                >
                  <badge.icon className="h-3.5 w-3.5" />
                  {badge.text}
                </div>
              ))}
            </motion.div>

            {/* Headline */}
            <div className="space-y-5">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-sm font-semibold text-primary uppercase tracking-wider"
              >
                Für Handwerker-Angebote & KFZ-Werkstatt-Rechnungen
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.1]"
              >
                Angebot erhalten?{" "}
                <span className="text-primary">Sofort prüfen</span>, ob der Preis fair ist.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground max-w-lg leading-relaxed"
              >
                Egal ob Dachdecker, Elektriker, Sanitär oder KFZ-Werkstatt – 
                laden Sie bis zu 3 Angebote hoch und sehen Sie sofort, welche Positionen auffällig sind.
              </motion.p>
            </div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-emerald-500/30 rounded-xl blur-lg opacity-60 group-hover:opacity-100 animate-pulse transition-opacity" />
                <Button
                  size="lg"
                  onClick={onUploadClick}
                  className="relative bg-emerald-600 hover:bg-emerald-700 text-white text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  Angebote hochladen
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
              <Button
                size="lg"
                variant="outline"
                onClick={scrollToDemo}
                className="text-base px-8 py-6 rounded-xl border-2"
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
              PDF, JPG, PNG, Excel • Max. 10 MB pro Datei
            </motion.p>
          </motion.div>

          {/* Right Visual - Abstract Graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="hidden lg:flex justify-center items-center"
          >
            <div className="relative w-full max-w-md">
              {/* Abstract Document Cards */}
              <div className="relative">
                {/* Background Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20, rotate: -3 }}
                  animate={{ opacity: 1, y: 0, rotate: -3 }}
                  transition={{ delay: 0.5 }}
                  className="absolute inset-0 bg-white/50 rounded-2xl border border-border/50 shadow-lg transform translate-x-4 translate-y-4"
                />
                
                {/* Middle Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20, rotate: 2 }}
                  animate={{ opacity: 1, y: 0, rotate: 2 }}
                  transition={{ delay: 0.6 }}
                  className="absolute inset-0 bg-white/70 rounded-2xl border border-border/50 shadow-lg transform translate-x-2 translate-y-2"
                />
                
                {/* Main Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="relative bg-card rounded-2xl border shadow-xl p-6"
                >
                  {/* Document Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <FileCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">Angebot analysiert</div>
                      <div className="text-sm text-muted-foreground">5 Positionen geprüft</div>
                    </div>
                  </div>

                  {/* Traffic Light Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div className="h-full w-3/4 bg-emerald-500/30 rounded-full" />
                      </div>
                      <span className="text-xs text-muted-foreground">3 ok</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div className="h-full w-1/4 bg-amber-500/30 rounded-full" />
                      </div>
                      <span className="text-xs text-muted-foreground">1 prüfen</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div className="h-full w-1/5 bg-red-500/30 rounded-full" />
                      </div>
                      <span className="text-xs text-muted-foreground">1 auffällig</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gesamt-Einordnung</span>
                      <span className="font-semibold text-amber-600">Prüfung empfohlen</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Subtle Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
