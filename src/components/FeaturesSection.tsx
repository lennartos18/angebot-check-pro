import { motion } from "framer-motion";
import { 
  Shield, 
  GitCompare, 
  Database, 
  MapPin, 
  FileText, 
  Lock 
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Ampelsystem",
    description: "Jede Position wird mit Grün, Gelb oder Rot bewertet – auf einen Blick erkennen Sie, wo Handlungsbedarf besteht.",
    color: "status-green",
  },
  {
    icon: GitCompare,
    title: "Multi-Angebot Vergleich",
    description: "Vergleichen Sie mehrere Angebote nebeneinander. Unsere Heatmap zeigt Unterschiede visuell auf.",
    color: "primary",
  },
  {
    icon: Database,
    title: "Wachsende Datenbank",
    description: "Mit jedem Angebot wird unsere Datenbank größer – für immer präzisere Analysen in Ihrer Region.",
    color: "primary",
  },
  {
    icon: MapPin,
    title: "DE-spezifisch",
    description: "Regionale Preise, lokale Materialkosten und deutsche Handwerksstandards werden berücksichtigt.",
    color: "status-yellow",
  },
  {
    icon: FileText,
    title: "Premium-Reports",
    description: "Detaillierte Handlungstipps, PDF-Export und Verhandlungsempfehlungen für jede Position.",
    color: "primary",
  },
  {
    icon: Lock,
    title: "DSGVO-konform",
    description: "Ihre Daten werden anonymisiert. Personenbezogene Informationen werden automatisch entfernt.",
    color: "status-green",
  },
];

export function FeaturesSection() {
  return (
    <section id="vorteile" className="py-20 sm:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Warum AngebotsCheck?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Deutschlands smarteste Plattform zur Prüfung von Handwerker-Angeboten
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-1 border border-border/50"
            >
              <div className={`w-12 h-12 rounded-lg bg-${feature.color}/10 flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 text-${feature.color}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
