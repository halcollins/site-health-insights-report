import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AnalysisResults from "@/components/AnalysisResults";

interface AnalysisResult {
  url: string;
  performanceScore: number;
  isWordPress: boolean;
  wpVersion?: string;
  theme?: string;
  plugins?: number;
  hasSSL: boolean;
  hasCDN: boolean;
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
  caching: 'enabled' | 'partial' | 'disabled';
  mobileScore: number;
  recommendations: string[];
}

const Analysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    // Get analysis result from location state or localStorage
    const analysisResult = location.state?.result || 
      JSON.parse(localStorage.getItem('analysisResult') || 'null');
    
    if (analysisResult) {
      setResult(analysisResult);
    } else {
      // If no result, redirect to home
      navigate('/');
    }
  }, [location.state, navigate]);

  const handleNewAnalysis = () => {
    localStorage.removeItem('analysisResult');
    navigate('/');
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <AnalysisResults result={result} onNewAnalysis={handleNewAnalysis} />
      </main>
    </div>
  );
};

export default Analysis;