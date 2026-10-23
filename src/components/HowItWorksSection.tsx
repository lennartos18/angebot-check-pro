import { motion } from "framer-motion";
import { Upload, Cpu, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Hochladen",
    description: "Bis zu 3 Dokumente per Drag & Drop hochladen. PDF oder Fotos (JPG, PNG).",
    color: "bg-blue-500",
  },
  {
    icon: Cpu,
    title: "Analyse",
    description: "KI prüft jede Position anhand regionaler Vergleichsdaten.",
    color: "bg-amber-500",
  },
  {
    icon: CheckCircle,
    title: "Ergebnis",
    description: "Ampelbewertung sofort sichtbar. Optional: Detailreport für 2,99 €.",
    color: "bg-emerald-500",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-section-alt relative">
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">
            So funktioniert's
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            In drei einfachen Schritten zur Einordnung Ihres Angebots
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-border" />
              )}

              <div className="relative bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow text-center">
                {/* Step Number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center text-sm font-bold text-primary">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 ${step.color} rounded-xl flex items-center justify-center mx-auto mb-4 mt-2`}>
                  <step.icon className="h-8 w-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
