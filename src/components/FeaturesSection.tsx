import { motion } from "framer-motion";
import { 
  CircleDot, 
  BarChart3, 
  MapPin, 
  Shield 
} from "lucide-react";

const features = [
  {
    icon: CircleDot,
    title: "Ampelsystem",
    description: "Grün, Gelb oder Rot – sehen Sie sofort, welche Positionen im Rahmen liegen und wo Sie nachfragen sollten.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Multi-Vergleich",
    description: "Laden Sie bis zu 3 Angebote hoch und vergleichen Sie diese nebeneinander. Relative Abweichungen werden markiert.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: MapPin,
    title: "Regional",
    description: "Vergleich basiert auf Marktdaten aus Ihrer Region (max. 150 km). Keine bundesweiten Durchschnitte.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Shield,
    title: "DSGVO-konform",
    description: "Ihre Daten werden anonymisiert und nach 24h gelöscht. Keine Speicherung, keine Weitergabe.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 bg-background relative">
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
            Warum AngebotsCheck?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Neutral, transparent und auf Ihre Region zugeschnitten
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-xl p-6 border hover:shadow-lg transition-shadow"
            >
              <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
