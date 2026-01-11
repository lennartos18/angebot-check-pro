import { Button } from "@/components/ui/button";
import { FileCheck, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg gradient-hero flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <FileCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">
              Angebots<span className="text-primary">Check</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#wie-es-funktioniert" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              So funktioniert's
            </a>
            <a href="#vorteile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Vorteile
            </a>
            <a href="#preise" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Preise
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Anmelden
            </Button>
            <Button size="sm">
              Angebot prüfen
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <a
                href="#wie-es-funktioniert"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                So funktioniert's
              </a>
              <a
                href="#vorteile"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Vorteile
              </a>
              <a
                href="#preise"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Preise
              </a>
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button variant="ghost" className="justify-start">
                  Anmelden
                </Button>
                <Button className="justify-start">
                  Angebot prüfen
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
