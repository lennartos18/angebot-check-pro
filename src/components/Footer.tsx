import { FileCheck, Shield, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AngebotsCheck</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">
              Impressum
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Datenschutz
            </a>
            <a href="#" className="hover:text-white transition-colors">
              AGB
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Kontakt
            </a>
          </nav>

          {/* Trust Badges */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>SSL-verschlüsselt</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} AngebotsCheck. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
}
