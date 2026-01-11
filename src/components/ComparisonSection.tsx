import { motion } from "framer-motion";
import { StatusBadge } from "@/components/StatusBadge";

const comparisonData = [
  { position: "Wandflächen grundieren", angebot1: 297, angebot2: 340, angebot3: 280 },
  { position: "Wände streichen", angebot1: 1020, angebot2: 890, angebot3: 1150 },
  { position: "Decke abhängen", angebot1: 2125, angebot2: 1950, angebot3: 2300 },
  { position: "Elektroinstallation", angebot1: 1140, angebot2: 780, angebot3: 920 },
  { position: "Bodenbelag verlegen", angebot1: 1710, angebot2: 1680, angebot3: 1890 },
];

function getHeatmapColor(value: number, min: number, max: number): string {
  const ratio = (value - min) / (max - min || 1);
  if (ratio < 0.33) return "bg-status-green/20 text-status-green-foreground";
  if (ratio < 0.66) return "bg-status-yellow/20 text-status-yellow-foreground";
  return "bg-status-red/20 text-status-red-foreground";
}

export function ComparisonSection() {
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
            Multi-Angebot Vergleich
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Heatmap-Visualisierung: Erkennen Sie auf einen Blick, welches Angebot günstiger ist
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
            {/* Legend */}
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-bold text-foreground">Preisvergleich – 3 Angebote</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-status-green/30" />
                  <span className="text-muted-foreground">Günstig</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-status-yellow/30" />
                  <span className="text-muted-foreground">Mittel</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-status-red/30" />
                  <span className="text-muted-foreground">Teuer</span>
                </div>
              </div>
            </div>

            {/* Heatmap Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/20">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span>Angebot A</span>
                        <StatusBadge status="yellow" size="sm" label="75" showIcon={false} className="mt-1" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span>Angebot B</span>
                        <StatusBadge status="green" size="sm" label="92" showIcon={false} className="mt-1" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span>Angebot C</span>
                        <StatusBadge status="red" size="sm" label="68" showIcon={false} className="mt-1" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonData.map((row, index) => {
                    const values = [row.angebot1, row.angebot2, row.angebot3];
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    
                    return (
                      <motion.tr
                        key={row.position}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <td className="px-6 py-4 font-medium text-foreground text-sm">{row.position}</td>
                        <td className={`px-6 py-4 text-center font-semibold text-sm ${getHeatmapColor(row.angebot1, min, max)}`}>
                          {row.angebot1.toLocaleString('de-DE')} €
                        </td>
                        <td className={`px-6 py-4 text-center font-semibold text-sm ${getHeatmapColor(row.angebot2, min, max)}`}>
                          {row.angebot2.toLocaleString('de-DE')} €
                        </td>
                        <td className={`px-6 py-4 text-center font-semibold text-sm ${getHeatmapColor(row.angebot3, min, max)}`}>
                          {row.angebot3.toLocaleString('de-DE')} €
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="px-6 py-4 font-bold text-foreground">Gesamt</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">6.292 €</td>
                    <td className="px-6 py-4 text-center font-bold text-status-green">5.640 €</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">6.540 €</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Recommendation */}
            <div className="px-6 py-4 bg-status-green-bg border-t border-status-green/20">
              <p className="text-sm text-status-green-foreground">
                <span className="font-bold">💡 Empfehlung:</span> Angebot B ist insgesamt am günstigsten und hat die beste Plausibilitätsbewertung.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
