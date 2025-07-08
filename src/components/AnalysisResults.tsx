import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, Globe, Shield, Zap, Image, Server, TrendingUp, Cpu } from "lucide-react";

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
}

interface AnalysisResultsProps {
  result: AnalysisResult;
  onNewAnalysis: () => void;
}

const AnalysisResults = ({ result, onNewAnalysis }: AnalysisResultsProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-5 h-5 text-success" />;
    if (score >= 60) return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  const getStatusBadge = (status: boolean | string, goodValue?: string) => {
    if (typeof status === 'boolean') {
      return status ? (
        <Badge variant="outline" className="border-success text-success">Enabled</Badge>
      ) : (
        <Badge variant="outline" className="border-destructive text-destructive">Disabled</Badge>
      );
    }
    
    const isGood = goodValue ? status === goodValue : status === 'good' || status === 'enabled';
    return (
      <Badge 
        variant="outline" 
        className={isGood ? "border-success text-success" : "border-warning text-warning"}
      >
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: string, dataSource: string) => {
    const isReal = dataSource === 'real';
    const badgeClass = isReal 
      ? "border-success text-success" 
      : confidence === 'medium' 
        ? "border-warning text-warning"
        : "border-muted text-muted-foreground";
    
    return (
      <Badge variant="outline" className={badgeClass}>
        {isReal ? 'Real Data' : 'Estimated'} • {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
      </Badge>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-foreground">
                Analysis Results
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Comprehensive audit for <span className="text-primary font-medium">{result.url}</span>
              </p>
            </div>
            <Button onClick={onNewAnalysis} variant="outline">
              Analyze Another Site
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Data Quality & Technologies */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Data Quality */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Data Quality</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Analysis Source</span>
              {getConfidenceBadge(result.confidence, result.dataSource)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Analyzed</span>
              <Badge variant="outline" className="border-muted text-muted-foreground">
                {new Date(result.analysisTimestamp).toLocaleDateString()}
              </Badge>
            </div>
            {result.dataSource === 'estimated' && (
              <p className="text-sm text-muted-foreground">
                💡 Scores are estimated based on technical analysis. Real PageSpeed data may vary.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Technology Stack */}
        {result.technologies && result.technologies.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-primary" />
                <span>Technology Stack</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.technologies.slice(0, 12).map((tech, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="border-primary/30 text-primary"
                    title={`${tech.category}${tech.version ? ` v${tech.version}` : ''}`}
                  >
                    {tech.name}
                  </Badge>
                ))}
                {result.technologies.length > 12 && (
                  <Badge variant="outline" className="border-muted text-muted-foreground">
                    +{result.technologies.length - 12} more
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Powered by BuiltWith API
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* WordPress Detection */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-primary" />
            <span>WordPress Detection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-foreground">WordPress Detected</span>
            {getStatusBadge(result.isWordPress)}
          </div>
          {result.isWordPress && (
            <>
              {result.wpVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground">WordPress Version</span>
                  <Badge variant="outline" className="border-muted text-foreground">
                    {result.wpVersion}
                  </Badge>
                </div>
              )}
              {result.theme && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Active Theme</span>
                  <Badge variant="outline" className="border-muted text-foreground">
                    {result.theme}
                  </Badge>
                </div>
              )}
              {result.plugins !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Active Plugins</span>
                  <Badge variant="outline" className="border-muted text-foreground">
                    {result.plugins} plugins
                  </Badge>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance Scores */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-primary" />
              <span>Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Desktop Score</span>
              <div className="flex items-center space-x-2">
                {getScoreIcon(result.performanceScore)}
                <span className={`font-bold ${getScoreColor(result.performanceScore)}`}>
                  {result.performanceScore}/100
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Mobile Score</span>
              <div className="flex items-center space-x-2">
                {getScoreIcon(result.mobileScore)}
                <span className={`font-bold ${getScoreColor(result.mobileScore)}`}>
                  {result.mobileScore}/100
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-primary" />
              <span>Security & Optimization</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">SSL Certificate</span>
              {getStatusBadge(result.hasSSL)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">CDN Usage</span>
              {getStatusBadge(result.hasCDN)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technical Details */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-primary" />
            <span>Technical Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-foreground">Image Optimization</span>
            {getStatusBadge(result.imageOptimization)}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">Caching</span>
            {getStatusBadge(result.caching)}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-warning mt-1 flex-shrink-0" />
                <span className="text-foreground">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-8 text-center space-y-4">
          <h3 className="text-2xl font-bold text-foreground">
            Need Help Optimizing Your WordPress Site?
          </h3>
          <p className="text-muted-foreground text-lg">
            Our WordPress experts can help you implement these recommendations and boost your site's performance, security, and SEO.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="outline" className="bg-primary hover:bg-primary/60 text-primary-foreground">
              <a href="mailto:hal.webtech@gmail.com?subject=Schedule Free Consultation">
                Schedule Free Consultation
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/40">
              <a href="mailto:hal.webtech@gmail.com?subject=Contact Us">
                Contact Us
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisResults;
