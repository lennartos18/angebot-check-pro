import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { DemoAnalysisSection } from "@/components/DemoAnalysisSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { PricingSection } from "@/components/PricingSection";
import { UploadSection } from "@/components/UploadSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <DemoAnalysisSection />
        <FeaturesSection />
        <ComparisonSection />
        <PricingSection />
        <UploadSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
