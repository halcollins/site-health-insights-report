import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import heroImage from "@/assets/hero-bg.jpg";
import { analysisService } from "@/services/analysisService";
import { leadService, type LeadData } from "@/services/leadService";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const performAnalysis = async (leadData: LeadData) => {
    console.log("=== performAnalysis STARTED ===", leadData);
    setIsAnalyzing(true);
    
    try {
      console.log("Creating lead and starting analysis for:", leadData.websiteUrl);
      
      // Create lead in database
      const lead = await leadService.createLead(leadData);
      console.log("Lead created:", lead);
      
      // Perform website analysis
      const result = await analysisService.analyzeWebsite(leadData.websiteUrl);
      console.log("Analysis completed:", result);
      
      // Calculate risk level
      const riskLevel = leadService.calculateRiskLevel(result);
      
      // Create analysis report in database
      const reportData = {
        leadId: lead.id,
        url: result.url,
        performanceScore: result.performanceScore,
        mobileScore: result.mobileScore,
        isWordpress: result.isWordPress,
        wpVersion: result.wpVersion,
        theme: result.theme,
        plugins: result.plugins,
        hasSSL: result.hasSSL,
        hasCDN: result.hasCDN,
        imageOptimization: result.imageOptimization,
        caching: result.caching,
        recommendations: result.recommendations,
        technologies: result.technologies,
        dataSource: result.dataSource,
        confidence: result.confidence,
        riskLevel
      };
      
      await leadService.createAnalysisReport(reportData);
      
      // Enhanced result with lead data and risk level
      const enhancedResult = {
        ...result,
        leadInfo: {
          name: leadData.name,
          email: leadData.email,
          company: leadData.company
        },
        riskLevel
      };
      
      // Store result and navigate
      localStorage.setItem('analysisResult', JSON.stringify(enhancedResult));
      setIsAnalyzing(false);
      navigate('/analysis', { state: { result: enhancedResult } });
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
          className="absolute inset-0 bg-hero-gradient opacity-95"
          style={{ 
            backgroundImage: `url(${heroImage})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay'
          }}
        />
        <div className="relative container mx-auto px-4">
          <LeadCaptureForm onSubmit={performAnalysis} isLoading={isAnalyzing} />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 id="features" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              What Your Security Report Reveals
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Get a comprehensive analysis that identifies critical business risks and revenue-impacting issues on your website.
            </p>
          </div>
            
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Critical Security Vulnerabilities",
                description: "Identify malware risks, outdated software, and security gaps that could expose your business to cyber attacks and data breaches.",
                icon: "🚨",
                color: "destructive"
              },
              {
                title: "Revenue-Impacting Performance Issues",
                description: "Discover slow loading pages, mobile optimization problems, and conversion killers that are costing you customers and sales.",
                icon: "📉",
                color: "orange"
              },
              {
                title: "Search Engine Penalty Risks",
                description: "Uncover SEO issues, technical problems, and compliance gaps that could trigger Google penalties and tank your rankings.",
                icon: "📉",
                color: "blue"
              },
              {
                title: "Customer Trust Indicators",
                description: "Assess SSL certificates, security badges, and trust signals that impact customer confidence and conversion rates.",
                icon: "🔒",
                color: "green"
              },
              {
                title: "Competitive Disadvantages",
                description: "Identify technical weaknesses that put you behind competitors and specific actions to regain your competitive edge.",
                icon: "⚔️",
                color: "purple"
              },
              {
                title: "Actionable Solutions",
                description: "Get prioritized recommendations with clear next steps to fix critical issues and protect your business.",
                icon: "🛠️",
                color: "primary"
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
