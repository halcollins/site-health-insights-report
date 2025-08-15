import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface UrlAnalysisFormProps {
  onAnalyze: (url: string) => void;
  isLoading?: boolean;
}

const UrlAnalysisForm = ({ onAnalyze, isLoading = false }: UrlAnalysisFormProps) => {
  const [url, setUrl] = useState("");
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
    
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a website URL to analyze.",
        variant: "destructive"
      });
      return;
    }

    if (!validateUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website URL.",
        variant: "destructive"
      });
      return;
    }

    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    onAnalyze(normalizedUrl);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto p-8 bg-card/50 backdrop-blur-sm border-border">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Analyze Your WordPress Site
          </h2>
          <p className="text-muted-foreground">
            Get a comprehensive audit of your WordPress website's performance, security, and optimization
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter your website URL (e.g., example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-14 text-lg pl-4 pr-4 bg-input border-border focus:ring-primary focus:border-primary"
              disabled={isLoading}
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
                <span>Analyzing...</span>
              </div>
            ) : (
              "Scan My Site"
            )}
          </Button>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Free analysis • No signup required • Get results in seconds
          </p>
        </div>
      </form>
    </Card>
  );
};

export default UrlAnalysisForm;