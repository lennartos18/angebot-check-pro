import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Kostenlos",
    price: "0€",
    period: "",
    description: "Für den ersten Überblick",
    features: [
      { text: "1 Angebot pro Monat", included: true },
      { text: "Basis-Ampelbewertung", included: true },
      { text: "5 Positionen", included: true },
      { text: "Detaillierte Hinweise", included: false },
      { text: "PDF-Export", included: false },
      { text: "Multi-Angebot Vergleich", included: false },
    ],
    cta: "Jetzt starten",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Premium",
    price: "9,90€",
    period: "/Analyse",
    description: "Für wichtige Projekte",
    features: [
      { text: "Unbegrenzte Positionen", included: true },
      { text: "Detaillierte Ampelbewertung", included: true },
      { text: "Handlungsempfehlungen", included: true },
      { text: "PDF-Report Download", included: true },
      { text: "Multi-Angebot Vergleich", included: true },
      { text: "E-Mail Support", included: true },
    ],
    cta: "Premium wählen",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "Pro",
    price: "29€",
    period: "/Monat",
    description: "Für Vielnutzer & Profis",
    features: [
      { text: "Alles aus Premium", included: true },
      { text: "Unbegrenzte Analysen", included: true },
      { text: "Historischer Vergleich", included: true },
      { text: "API-Zugang", included: true },
      { text: "Prioritäts-Support", included: true },
      { text: "Früher Zugang zu Features", included: true },
    ],
    cta: "Pro testen",
    variant: "outline" as const,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="preise" className="py-20 sm:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Transparente Preise
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Starten Sie kostenlos – upgraden Sie, wenn Sie mehr brauchen
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative bg-card rounded-2xl p-6 lg:p-8 border transition-all ${
                plan.popular
                  ? "border-primary shadow-xl scale-105 z-10"
                  : "border-border shadow-card hover:shadow-card-hover"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Beliebt
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-foreground mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-status-green flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${feature.included ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button variant={plan.variant} className="w-full" size="lg">
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
