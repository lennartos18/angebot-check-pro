import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { Upload, Shield, TrendingUp, ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onUploadClick?: () => void;
}

export function HeroSection({ onUploadClick }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 gradient-hero opacity-[0.03]" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />
      
      {/* Floating Elements */}
      <motion.div
        className="absolute top-32 right-[15%] hidden lg:block"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <StatusBadge status="green" size="lg" />
      </motion.div>
      <motion.div
        className="absolute top-48 right-[8%] hidden lg:block"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <StatusBadge status="yellow" size="lg" />
      </motion.div>
      <motion.div
        className="absolute top-64 right-[20%] hidden lg:block"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <StatusBadge status="red" size="lg" />
      </motion.div>

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl">
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
            <Button variant="outline" size="xl">
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
      </div>
    </section>
  );
}
