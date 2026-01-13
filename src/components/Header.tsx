import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileCheck, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface HeaderProps {
  onUploadClick?: () => void;
}

export function Header({ onUploadClick }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">AngebotsCheck</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("demo")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Demo
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Vorteile
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              FAQ
            </button>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              onClick={onUploadClick}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Angebot prüfen
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t"
            >
              <nav className="flex flex-col py-4 gap-2">
                <button
                  onClick={() => scrollToSection("demo")}
                  className="px-4 py-2 text-left hover:bg-muted rounded-lg transition-colors"
                >
                  Demo
                </button>
                <button
                  onClick={() => scrollToSection("features")}
                  className="px-4 py-2 text-left hover:bg-muted rounded-lg transition-colors"
                >
                  Vorteile
                </button>
                <button
                  onClick={() => scrollToSection("faq")}
                  className="px-4 py-2 text-left hover:bg-muted rounded-lg transition-colors"
                >
                  FAQ
                </button>
                <div className="px-4 pt-2">
                  <Button
                    onClick={() => {
                      onUploadClick?.();
                      setIsMenuOpen(false);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Angebot prüfen
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
