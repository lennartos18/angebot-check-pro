import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { DemoAnalysisSection } from "@/components/DemoAnalysisSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { PricingSection } from "@/components/PricingSection";
import { UploadSection } from "@/components/UploadSection";
import { Footer } from "@/components/Footer";
import { GuestUploadModal, GuestAnalysisResult } from "@/components/GuestUploadModal";
import { GuestAnalysisView } from "@/components/GuestAnalysisView";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [guestAnalysis, setGuestAnalysis] = useState<GuestAnalysisResult | null>(null);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleAnalysisComplete = (analysis: GuestAnalysisResult) => {
    setShowUploadModal(false);
    setGuestAnalysis(analysis);
  };

  const handleLoginRequired = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onUploadClick={handleUploadClick} />
      <main>
        <HeroSection onUploadClick={handleUploadClick} />
        <HowItWorksSection />
        <DemoAnalysisSection />
        <FeaturesSection />
        <ComparisonSection />
        <PricingSection />
        <UploadSection onUploadClick={handleUploadClick} />
      </main>
      <Footer />

      {/* Guest Upload Modal */}
      <GuestUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Guest Analysis View */}
      {guestAnalysis && (
        <GuestAnalysisView
          analysis={guestAnalysis}
          onClose={() => setGuestAnalysis(null)}
          onLoginRequired={handleLoginRequired}
        />
      )}
    </div>
  );
};

export default Index;
