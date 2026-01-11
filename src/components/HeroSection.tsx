import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { Upload, Shield, TrendingUp, ArrowRight, Play } from "lucide-react";
import heroCraftsman from "@/assets/hero-craftsman.jpg";

interface HeroSectionProps {
  onUploadClick?: () => void;
}

export function HeroSection({ onUploadClick }: HeroSectionProps) {
  const scrollToDemo = () => {
    const demoSection = document.getElementById("demo");
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 gradient-hero opacity-[0.03]" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />

      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Content */}
          <div>
            {/* Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 bg-accent px-4 py-2 rounded-full mb-6"
            >
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">
                100% DSGVO-konform & anonymisiert
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6"
            >
              Handwerker-Angebote
              <br />
              <span className="text-primary">transparent prüfen</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed"
            >
              Laden Sie Ihr Angebot hoch und erhalten Sie sofort eine Plausibilitätsprüfung. 
              Unser Ampelsystem zeigt Ihnen, welche Positionen fair sind – und wo Sie nachfragen sollten.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="flex flex-col sm:flex-row gap-4 mb-12"
            >
              <Button variant="hero" size="xl" className="group" onClick={onUploadClick}>
                <Upload className="w-5 h-5" />
                Angebot hochladen
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="xl" onClick={scrollToDemo} className="group">
                <Play className="w-5 h-5" />
                Demo ansehen
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-wrap gap-8 sm:gap-12"
            >
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-foreground">10.000+</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Geprüfte Angebote</p>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-foreground">∅ 847€</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Ersparnis pro Projekt</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-status-green" />
                  <span className="text-3xl sm:text-4xl font-bold text-foreground">94%</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Kundenzufriedenheit</p>
              </div>
            </motion.div>
          </div>

          {/* Right side - Image with floating badges */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            {/* Main Image */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
              <img
                src={heroCraftsman}
                alt="Handwerker prüft Angebot"
                className="relative rounded-2xl shadow-2xl w-full max-w-lg mx-auto object-cover"
              />
              
              {/* Floating Status Badges */}
              <motion.div
                className="absolute -top-4 -right-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <StatusBadge status="green" size="lg" />
              </motion.div>
              <motion.div
                className="absolute top-1/3 -right-8"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <StatusBadge status="yellow" size="lg" />
              </motion.div>
              <motion.div
                className="absolute bottom-1/4 -left-6"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <StatusBadge status="red" size="lg" />
              </motion.div>

              {/* Analysis Card Overlay */}
              <motion.div
                className="absolute -bottom-6 -left-6 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-border"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-status-green-bg flex items-center justify-center">
                    <span className="text-xl font-bold text-status-green">87</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Plausibilitäts-Score</p>
                    <p className="text-xs text-muted-foreground">Ihr Angebot ist fair!</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
