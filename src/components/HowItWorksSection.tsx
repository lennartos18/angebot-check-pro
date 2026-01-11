import { motion } from "framer-motion";
import { Upload, Search, BarChart3, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "1. Angebot hochladen",
    description: "Laden Sie Ihr Handwerker-Angebot als PDF oder Foto hoch. Wir extrahieren alle relevanten Positionen automatisch.",
  },
  {
    icon: Search,
    title: "2. KI-Analyse",
    description: "Unsere KI vergleicht jede Position mit unserer Datenbank regionaler Preise und erkennt Auffälligkeiten.",
  },
  {
    icon: BarChart3,
    title: "3. Ampelbewertung",
    description: "Jede Position erhält einen Score: Grün (plausibel), Gelb (prüfen) oder Rot (auffällig).",
  },
  {
    icon: CheckCircle,
    title: "4. Handeln",
    description: "Nutzen Sie unsere Hinweise für Verhandlungen oder vergleichen Sie mit weiteren Angeboten.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="wie-es-funktioniert" className="py-20 sm:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            So funktioniert's
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            In nur 4 Schritten von der Unsicherheit zur Transparenz
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
              )}
              
              <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow h-full border border-border/50">
                <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center mb-5 shadow-md">
                  <step.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
