import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronRight, Info } from "lucide-react";

const demoPositions = [
  {
    position: "Wandflächen grundieren",
    material: "Tiefengrund",
    menge: "85 m²",
    einzelpreis: "3,50 €/m²",
    gesamt: "297,50 €",
    status: "green" as const,
    hinweis: "Üblicher Preis für Grundierung",
  },
  {
    position: "Wände streichen",
    material: "Dispersionsfarbe 2x",
    menge: "85 m²",
    einzelpreis: "12,00 €/m²",
    gesamt: "1.020,00 €",
    status: "green" as const,
    hinweis: "Marktüblicher Preis inkl. 2 Anstriche",
  },
  {
    position: "Decke abhängen",
    material: "Rigips GK",
    menge: "25 m²",
    einzelpreis: "85,00 €/m²",
    gesamt: "2.125,00 €",
    status: "yellow" as const,
    hinweis: "Preis liegt 15% über Durchschnitt – nachfragen empfohlen",
  },
  {
    position: "Elektroinstallation",
    material: "Steckdosen + Verkabelung",
    menge: "12 Stück",
    einzelpreis: "95,00 €/Stk",
    gesamt: "1.140,00 €",
    status: "red" as const,
    hinweis: "Deutlich über Marktpreis – unbedingt Alternativangebot einholen",
  },
  {
    position: "Bodenbelag verlegen",
    material: "Vinyl-Klick",
    menge: "45 m²",
    einzelpreis: "38,00 €/m²",
    gesamt: "1.710,00 €",
    status: "green" as const,
    hinweis: "Fairer Preis für qualitatives Vinyl",
  },
];

export function DemoAnalysisSection() {
  const totalGreen = demoPositions.filter(p => p.status === "green").length;
  const totalYellow = demoPositions.filter(p => p.status === "yellow").length;
  const totalRed = demoPositions.filter(p => p.status === "red").length;

  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Live-Demo: Ampelbewertung
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            So sieht Ihre Analyse aus – jede Position wird einzeln bewertet
          </p>
        </motion.div>

        {/* Analysis Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-muted/50 px-6 py-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-bold text-foreground">Angebot: Renovierung Wohnzimmer</h3>
                  <p className="text-sm text-muted-foreground">Malerbetrieb Müller GmbH • München • 15.01.2026</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 h-3 rounded-full bg-status-green" />
                    <span className="text-muted-foreground">{totalGreen}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 h-3 rounded-full bg-status-yellow" />
                    <span className="text-muted-foreground">{totalYellow}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 h-3 rounded-full bg-status-red" />
                    <span className="text-muted-foreground">{totalRed}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Material</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Menge</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right hidden md:table-cell">EP</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Gesamt</th>
                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {demoPositions.map((item, index) => (
                    <motion.tr
                      key={item.position}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{item.position}</div>
                        <div className="sm:hidden text-xs text-muted-foreground mt-0.5">{item.material}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground hidden sm:table-cell">{item.material}</td>
                      <td className="px-6 py-4 text-sm text-foreground text-right">{item.menge}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground text-right hidden md:table-cell">{item.einzelpreis}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-foreground text-right">{item.gesamt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <StatusBadge status={item.status} size="sm" />
                          <div className="relative group/tooltip">
                            <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                            <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-background text-xs rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              {item.hinweis}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                            </div>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td colSpan={4} className="px-6 py-4 font-bold text-foreground">Gesamtsumme</td>
                    <td className="px-6 py-4 font-bold text-foreground text-right">6.292,50 €</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-status-yellow">75/100</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer CTA */}
            <div className="px-6 py-4 bg-accent/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Empfehlung:</span> Bei 2 Positionen sollten Sie nachfragen
              </p>
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors">
                Vollständigen Report ansehen
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
