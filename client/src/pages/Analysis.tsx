import { useLocation } from "wouter";
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
  technologies?: Array<{
    name: string;
    confidence: number;
    version?: string;
    category: string;
  }>;
  dataSource: 'real' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  analysisTimestamp: string;
  leadInfo?: {
    name: string;
    email: string;
    company?: string;
  };
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
}

const Analysis = () => {
  const [location, setLocation] = useLocation();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    // Get analysis result from localStorage
    const analysisResult = JSON.parse(localStorage.getItem('analysisResult') || 'null');
    
    if (analysisResult) {
      setResult(analysisResult);
    } else {
      // If no result, redirect to home
      setLocation('/');
    }
  }, [setLocation]);

  const handleNewAnalysis = () => {
    localStorage.removeItem('analysisResult');
    setLocation('/');
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