import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Shield, Target, CreditCard, UserX } from "lucide-react";

const faqs = [
  {
    icon: Shield,
    question: "Was passiert mit meinen Daten?",
    answer: "Ihre Dokumente werden ausschließlich zur Analyse verwendet und nach 24 Stunden automatisch gelöscht. Personenbezogene Daten wie Firmennamen werden anonymisiert. Die Verarbeitung erfolgt DSGVO-konform auf deutschen Servern."
  },
  {
    icon: Target,
    question: "Wie genau ist die Bewertung?",
    answer: "Die Einordnung basiert auf regionalen Vergleichsdaten (max. 150 km Umkreis) aus den letzten 12 Monaten. Bei geringer Datenlage wird dies transparent kommuniziert. Die Bewertung ist indikativ – keine Kaufempfehlung oder rechtliche Beratung."
  },
  {
    icon: CreditCard,
    question: "Was kostet der PDF-Report?",
    answer: "Die Basis-Analyse mit Ampelbewertung ist kostenlos. Der detaillierte PDF-Report mit Quartilen, Heatmaps und Vergleichsanalyse kostet einmalig 2,99 €. Keine versteckten Kosten, kein Abo."
  },
  {
    icon: UserX,
    question: "Muss ich mich registrieren?",
    answer: "Nein. Sie können sofort Dokumente hochladen und die Analyse starten – ohne Registrierung, ohne Login. Auch der PDF-Kauf funktioniert ohne Account über Apple Pay, Google Pay oder PayPal."
  }
];

export function FAQSection() {
  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Häufige Fragen
          </h2>
          <p className="text-muted-foreground">
            Transparenz ist uns wichtig – hier die Antworten auf die wichtigsten Fragen.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-background rounded-lg border px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left">
                    <faq.icon className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-medium">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 pl-8">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
