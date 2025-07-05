import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import UrlAnalysisForm from "@/components/UrlAnalysisForm";
import heroImage from "@/assets/hero-bg.jpg";
import { analysisService } from "@/services/analysisService";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const performAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    
    try {
      const result = await analysisService.analyzeWebsite(url);
      
      // Store result and navigate
      localStorage.setItem('analysisResult', JSON.stringify(result));
      setIsAnalyzing(false);
      navigate('/analysis', { state: { result } });
    } catch (error) {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unable to analyze website. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div 
          className="absolute inset-0 bg-hero-gradient opacity-90"
          style={{ 
            backgroundImage: `url(${heroImage})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay'
          }}
        />
        <div className="relative container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Optimize Your{" "}
              <span className="text-primary">WordPress</span>{" "}
              Website
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Get a comprehensive analysis of your WordPress site's performance, security, and optimization opportunities. Free audit in seconds.
            </p>
            
            <div className="pt-8">
              <UrlAnalysisForm onAnalyze={performAnalysis} isLoading={isAnalyzing} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Complete WordPress Analysis
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive audit covers all critical aspects of your WordPress website
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Performance Analysis",
                description: "Core Web Vitals, page speed, and mobile optimization scores",
                icon: "⚡"
              },
              {
                title: "Security Assessment", 
                description: "SSL certificates, WordPress version, and vulnerability checks",
                icon: "🔒"
              },
              {
                title: "SEO Optimization",
                description: "Technical SEO factors and search engine visibility",
                icon: "📈"
              },
              {
                title: "Image Optimization",
                description: "Image compression, format recommendations, and CDN usage",
                icon: "🖼️"
              },
              {
                title: "Caching Analysis",
                description: "Server-side and browser caching configuration review",
                icon: "💾"
              },
              {
                title: "Plugin Assessment",
                description: "Active plugins, theme detection, and compatibility checks",
                icon: "🔌"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
