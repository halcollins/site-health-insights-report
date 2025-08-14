import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, TrendingDown, Search } from "lucide-react";

interface LeadCaptureFormProps {
  onSubmit: (leadData: {
    name: string;
    email: string;
    websiteUrl: string;
  }) => void;
  isLoading?: boolean;
}

const LeadCaptureForm = ({ onSubmit, isLoading = false }: LeadCaptureFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    websiteUrl: ""
  });
  const { toast } = useToast();

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.websiteUrl.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to generate your security report.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    if (!validateUrl(formData.websiteUrl)) {
      toast({
        title: "Invalid Website URL",
        description: "Please enter a valid website URL.",
        variant: "destructive"
      });
      return;
    }

    // Normalize URL
    const normalizedUrl = formData.websiteUrl.startsWith('http') 
      ? formData.websiteUrl 
      : `https://${formData.websiteUrl}`;

    console.log("=== FORM SUBMISSION ===", formData);
    console.log("Normalized URL:", normalizedUrl);
    
    onSubmit({
      ...formData,
      websiteUrl: normalizedUrl
    });
    
    console.log("onSubmit called successfully");
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-destructive/10 rounded-full">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground">
          Free Website Security Checklist
        </h1>
        <p className="text-xl text-foreground max-w-2xl mx-auto">
          Get a comprehensive security audit that reveals critical vulnerabilities, 
          performance issues, and compliance gaps that could be costing your business.
        </p>
        <br />
      </div>

      {/* Risk Indicators */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="flex items-center space-x-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <AlertTriangle className="w-6 h-6 text-orange-600" />
          <div>
            <h3 className="font-semibold text-sm">Security Vulnerabilities</h3>
            <p className="text-xs text-muted-foreground">Malware & hacking risks</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <TrendingDown className="w-6 h-6 text-orange-600" />
          <div>
            <h3 className="font-semibold text-sm">Revenue Impact</h3>
            <p className="text-xs text-muted-foreground">Performance & conversion loss</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <Search className="w-6 h-6 text-orange-600" />
          <div>
            <h3 className="font-semibold text-sm">SEO Penalties</h3>
            <p className="text-xs text-muted-foreground">Search ranking threats</p>
          </div>
        </div>
      </div>
      </Card>

      {/* Lead Capture Form */}
      <Card className="p-8 bg-card/50 backdrop-blur-sm border-border">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Get Your Free Security Report
            </h2>
            <p className="text-muted-foreground">
              Enter your details below and we'll analyze your website in seconds
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Full Name *
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="h-12"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Business Email *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="h-12"
                disabled={isLoading}
                required
              />
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="website" className="text-sm font-medium">
              Website URL *
            </Label>
            <Input
              id="website"
              type="text"
              placeholder="yourwebsite.com"
              value={formData.websiteUrl}
              onChange={(e) => updateField('websiteUrl', e.target.value)}
              className="h-12"
              disabled={isLoading}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                <span>Analyzing Your Website Security...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Get My Free Security Report</span>
              </div>
            )}
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              🔒 100% Free Analysis • No Credit Card Required • Instant Results
            </p>
          </div>
        </form>
      </Card>

      {/* Trust Indicators */}
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          Trusted by businesses to identify critical security gaps
        </p>
        <div className="flex justify-center items-center space-x-6 text-xs text-muted-foreground">
          <span>✓ SSL Certificate Analysis</span>
          <span>✓ Malware Detection</span>
          <span>✓ Performance Audit</span>
          <span>✓ SEO Risk Assessment</span>
        </div>
      </div>
    </div>
  );
};

export default LeadCaptureForm;