import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield, UserX, Eye, Wrench, Car } from "lucide-react";
import { AnimatedTrafficLight } from "./AnimatedTrafficLight";
import heroImage from "@/assets/hero-craftsman-mechanic.jpg";

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
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-3"
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
            <div className="space-y-4">
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
                className="text-lg md:text-xl text-muted-foreground max-w-xl"
              >
                Egal ob Dachdecker, Elektriker, Sanitär oder Ihre KFZ-Werkstatt – 
                laden Sie bis zu 3 Angebote hoch und sehen Sie sofort, welche Positionen auffällig sind.
              </motion.p>
            </div>

            {/* Category badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-wrap gap-3"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Wrench className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">Handwerk</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Car className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-700 dark:text-blue-400">KFZ-Werkstatt</span>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
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
          </motion.div>

          {/* Right Visual - Hero Image with Traffic Light */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="hidden lg:flex justify-center items-center"
          >
            <div className="relative w-full max-w-lg">
              {/* Hero Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
                <img 
                  src={heroImage} 
                  alt="Handwerker und KFZ-Mechaniker - Beide Branchen abgedeckt"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                
                {/* Overlay text */}
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-sm text-foreground/90 font-medium text-center">
                    Für alle Handwerks- und KFZ-Werkstatt-Angebote
                  </p>
                </div>
              </div>
              
              {/* Traffic Light Badge */}
              <div className="absolute -bottom-6 -right-6 md:-right-12 scale-50 origin-bottom-right">
                <div className="bg-card rounded-xl shadow-xl border border-border p-2">
                  <AnimatedTrafficLight />
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
            </div>
          </motion.div>
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
