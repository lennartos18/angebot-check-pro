import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { UploadModal } from "@/components/UploadModal";
import { AnalysisView } from "@/components/AnalysisView";
import { 
  FileCheck, 
  Plus, 
  LogOut, 
  User, 
  Loader2,
  FileText,
  TrendingUp,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface Angebot {
  id: string;
  title: string;
  handwerker_firma: string | null;
  stadt: string | null;
  gesamtpreis: number | null;
  plausibility_score: number | null;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [angebote, setAngebote] = useState<Angebot[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedAngebotId, setSelectedAngebotId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchAngebote();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAngebote = async () => {
    const { data, error } = await supabase
      .from("angebote")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching angebote:", error);
      return;
    }

    setAngebote(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Abgemeldet",
      description: "Sie wurden erfolgreich abgemeldet.",
    });
    navigate("/");
  };

  const getScoreStatus = (score: number | null): "green" | "yellow" | "red" => {
    if (!score) return "yellow";
    if (score >= 80) return "green";
    if (score >= 60) return "yellow";
    return "red";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedAngebotId) {
    return (
      <AnalysisView
        angebotId={selectedAngebotId}
        onBack={() => {
          setSelectedAngebotId(null);
          fetchAngebote();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-hero flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">
              Angebots<span className="text-primary">Check</span>
            </span>
          </a>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              {user?.email}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-6 border border-border shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{angebote.length}</p>
                <p className="text-sm text-muted-foreground">Angebote analysiert</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-6 border border-border shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-status-green/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-status-green" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {angebote.length > 0
                    ? Math.round(
                        angebote.reduce((acc, a) => acc + (a.plausibility_score || 0), 0) /
                          angebote.filter(a => a.plausibility_score).length
                      ) || 0
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground">Ø Plausibilitäts-Score</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-6 border border-border shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {angebote.filter(a => a.status === "pending" || a.status === "analyzing").length}
                </p>
                <p className="text-sm text-muted-foreground">In Bearbeitung</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Meine Angebote</h1>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Neues Angebot
          </Button>
        </div>

        {/* Angebote List */}
        {angebote.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl p-12 border border-dashed border-border text-center"
          >
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Noch keine Angebote
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Laden Sie Ihr erstes Handwerker-Angebot hoch und erhalten Sie eine
              detaillierte Plausibilitätsprüfung.
            </p>
            <Button onClick={() => setUploadModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Erstes Angebot hochladen
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {angebote.map((angebot, idx) => (
              <motion.div
                key={angebot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
                onClick={() => setSelectedAngebotId(angebot.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      {angebot.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {angebot.handwerker_firma || "Unbekannter Handwerker"}
                      {angebot.stadt && ` • ${angebot.stadt}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(angebot.created_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {angebot.gesamtpreis && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {angebot.gesamtpreis.toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">Angebotssumme</p>
                      </div>
                    )}

                    {angebot.status === "completed" && angebot.plausibility_score ? (
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge
                          status={getScoreStatus(angebot.plausibility_score)}
                          label={`${angebot.plausibility_score}`}
                          showIcon={false}
                          size="lg"
                        />
                        <span className="text-xs text-muted-foreground">Score</span>
                      </div>
                    ) : angebot.status === "analyzing" ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Analysiert...</span>
                      </div>
                    ) : angebot.status === "error" ? (
                      <StatusBadge status="red" label="Fehler" />
                    ) : (
                      <StatusBadge status="yellow" label="Ausstehend" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false);
          fetchAngebote();
        }}
      />
    </div>
  );
}