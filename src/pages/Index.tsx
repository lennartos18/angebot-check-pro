import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { DemoAnalysisSection } from "@/components/DemoAnalysisSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { MultiUploadModal } from "@/components/MultiUploadModal";
import { MultiDocumentAnalysisView } from "@/components/MultiDocumentAnalysisView";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleAnalysisComplete = (data: any) => {
    setShowUploadModal(false);
    setAnalysisData(data);
  };

  const handleRequestPDF = () => {
    toast({
      title: "PDF-Report",
      description: "Die Stripe-Zahlung wird in Kürze aktiviert. Preis: 2,99€",
    });
  };

  // Show analysis view if we have results
  if (analysisData) {
    return (
      <MultiDocumentAnalysisView
        analysisData={analysisData}
        onRequestPDF={handleRequestPDF}
        onClose={() => setAnalysisData(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onUploadClick={handleUploadClick} />
      <main>
        <HeroSection onUploadClick={handleUploadClick} />
        <HowItWorksSection />
        <DemoAnalysisSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <section id="faq">
          <FAQSection />
        </section>
      </main>
      <Footer />

      {/* Multi Upload Modal */}
      <MultiUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />
    </div>
  );
};

export default Index;
