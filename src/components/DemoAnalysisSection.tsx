import { motion } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, FileText, BarChart3 } from "lucide-react";

// Demo data for single analysis
const demoPositions = [
  {
    position: "Fliesenleger – Wandfliesen",
    material: "Feinsteinzeug 60x30",
    quantity: "12 m²",
    status: "green" as const,
    note: "Im regionalen Rahmen für München, Q4 2024",
  },
  {
    position: "Sanitärinstallation",
    material: "Waschbecken mit Armatur",
    quantity: "1 Stk",
    status: "yellow" as const,
    note: "Leicht über dem regionalen Vergleich (+12%)",
  },
  {
    position: "Elektroinstallation",
    material: "Steckdosen, Schalter",
    quantity: "8 Stk",
    status: "green" as const,
    note: "Im regionalen Rahmen für München, Q4 2024",
  },
  {
    position: "Malerarbeiten",
    material: "Dispersionsfarbe",
    quantity: "45 m²",
    status: "red" as const,
    note: "Auffällig hoch – Alternativangebot empfohlen",
  },
  {
    position: "Trockenbau",
    material: "Gipskartonplatten",
    quantity: "18 m²",
    status: "green" as const,
    note: "Im regionalen Rahmen für München, Q4 2024",
  },
];

// Demo data for comparison view
const comparisonData = [
  {
    position: "Fliesenleger – Wandfliesen",
    doc1: { deviation: "Basis" },
    doc2: { deviation: "+9%" },
    doc3: { deviation: "-7%" },
  },
  {
    position: "Sanitärinstallation",
    doc1: { deviation: "Basis" },
    doc2: { deviation: "-16%" },
    doc3: { deviation: "+9%" },
  },
  {
    position: "Elektroinstallation",
    doc1: { deviation: "Basis" },
    doc2: { deviation: "+6%" },
    doc3: { deviation: "-4%" },
  },
  {
    position: "Malerarbeiten",
    doc1: { deviation: "Basis" },
    doc2: { deviation: "-26%" },
    doc3: { deviation: "-21%" },
  },
];

function getDeviationColor(deviation: string) {
  if (deviation === "Basis") return "text-muted-foreground";
  const value = parseInt(deviation);
  if (value <= -15) return "text-emerald-600 font-medium";
  if (value < 0) return "text-emerald-500";
  if (value >= 15) return "text-red-600 font-medium";
  if (value > 0) return "text-amber-500";
  return "text-muted-foreground";
}

export function DemoAnalysisSection() {
  return (
    <section id="demo" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Live-Demo: So sieht Ihre Analyse aus
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Beispielhafte Darstellung einer Badezimmer-Renovierung in München
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Einzelanalyse
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Angebots-Vergleich
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <CardTitle className="text-lg">Angebot: Badezimmer-Renovierung</CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">3 im Rahmen</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-muted-foreground">1 prüfen</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">1 auffällig</span>
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Position</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Material</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Menge</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <TooltipProvider>
                          {demoPositions.map((item, index) => (
                            <tr key={index} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium">{item.position}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{item.material}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{item.quantity}</td>
                              <td className="py-3 px-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help">
                                      <StatusBadge status={item.status} />
                                      <Info className="h-4 w-4 text-muted-foreground/50" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{item.note}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            </tr>
                          ))}
                        </TooltipProvider>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm flex-wrap gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Info className="h-4 w-4" />
                      Basierend auf 47 Vergleichspositionen, Region München, Q4 2024
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Vergleich: 3 Angebote nebeneinander</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Position</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Angebot A</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Angebot B</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Angebot C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.map((item, index) => (
                          <tr key={index} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-sm font-medium">{item.position}</td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm ${getDeviationColor(item.doc1.deviation)}`}>
                                {item.doc1.deviation}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm ${getDeviationColor(item.doc2.deviation)}`}>
                                {item.doc2.deviation}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm ${getDeviationColor(item.doc3.deviation)}`}>
                                {item.doc3.deviation}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Visual Heatmap Summary */}
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Gesamtbewertung</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                        <div className="text-lg font-bold text-amber-700 dark:text-amber-400">Angebot A</div>
                        <div className="text-sm text-muted-foreground">Referenz</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Angebot B</div>
                        <div className="text-sm text-muted-foreground">-8% günstiger</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Angebot C</div>
                        <div className="text-sm text-muted-foreground">-6% günstiger</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </section>
  );
}
