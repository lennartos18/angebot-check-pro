import { FileCheck, Shield, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">
                Angebots<span className="text-primary">Check</span>
              </span>
            </a>
            <p className="text-sm text-background/60 leading-relaxed">
              Deutschlands smarteste Plattform zur Prüfung von Handwerker-Angeboten.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4 text-background/80">Produkt</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><a href="#wie-es-funktioniert" className="hover:text-background transition-colors">So funktioniert's</a></li>
              <li><a href="#vorteile" className="hover:text-background transition-colors">Vorteile</a></li>
              <li><a href="#preise" className="hover:text-background transition-colors">Preise</a></li>
              <li><a href="#" className="hover:text-background transition-colors">API</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-background/80">Unternehmen</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Über uns</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Karriere</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Presse</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-background/80">Rechtliches</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Impressum</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Datenschutz</a></li>
              <li><a href="#" className="hover:text-background transition-colors">AGB</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Cookie-Einstellungen</a></li>
            </ul>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="border-t border-background/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-background/50">
              <Shield className="w-4 h-4" />
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-background/50">
              <Lock className="w-4 h-4" />
              <span>SSL-verschlüsselt</span>
            </div>
          </div>
          <p className="text-xs text-background/40">
            © 2026 AngebotsCheck. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  );
}
