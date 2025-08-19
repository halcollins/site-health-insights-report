import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, Globe, Shield, Zap, Image, Server, TrendingUp, Cpu, FileText, Download, Lock, Unlock, Eye, EyeOff } from "lucide-react";

interface SecurityFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
  cvssScore?: number;
  cveId?: string;
}

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
  securityFindings?: SecurityFinding[];
  wpSecurityIssues?: any[];
  missingSecurityHeaders?: string[];
  overallSecurityScore?: number;
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

  const getRiskLevelBadge = (riskLevel?: string) => {
    if (!riskLevel) return null;
    
    const riskColors = {
      critical: "border-destructive text-destructive bg-destructive/10",
      high: "border-orange-500 text-orange-600 bg-orange-50",
      medium: "border-yellow-500 text-yellow-600 bg-yellow-50",
      low: "border-green-500 text-green-600 bg-green-50"
    };
    
    return (
      <Badge className={riskColors[riskLevel as keyof typeof riskColors]}>
        {riskLevel.toUpperCase()} RISK
      </Badge>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <CardTitle className="text-2xl text-foreground">
                  Website Security Report
                </CardTitle>
                {result.riskLevel && getRiskLevelBadge(result.riskLevel)}
              </div>
              {result.leadInfo && (
                <p className="text-sm text-muted-foreground">
                  Report for {result.leadInfo.name} {result.leadInfo.company && `• ${result.leadInfo.company}`}
                </p>
              )}
              <p className="text-muted-foreground">
                Security and performance analysis for <span className="text-primary font-medium">{result.url}</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Coming Soon - Download PDF</span>
              </Button>
              <Button onClick={onNewAnalysis} variant="outline">
                Analyze Another Site
              </Button>
            </div>
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

      {/* Comprehensive Security Analysis */}
      {(result.securityFindings && result.securityFindings.length > 0) || (result.overallSecurityScore !== undefined) || (result.missingSecurityHeaders && result.missingSecurityHeaders.length > 0) ? (
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-primary" />
              <span>Security Assessment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Security Score */}
            {result.overallSecurityScore !== undefined && (
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border">
                <span className="text-foreground font-medium">Overall Security Score</span>
                <div className="flex items-center space-x-2">
                  {getScoreIcon(result.overallSecurityScore)}
                  <span className={`font-bold text-lg ${getScoreColor(result.overallSecurityScore)}`}>
                    {result.overallSecurityScore}/100
                  </span>
                </div>
              </div>
            )}

            {/* Security Findings */}
            {result.securityFindings && result.securityFindings.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground text-sm">Security Vulnerabilities Found</h4>
                <div className="space-y-3">
                  {result.securityFindings.slice(0, 8).map((finding, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border-l-4 ${
                        finding.severity === 'critical' ? 'bg-red-50 border-l-red-500 border border-red-200' :
                        finding.severity === 'high' ? 'bg-orange-50 border-l-orange-500 border border-orange-200' :
                        finding.severity === 'medium' ? 'bg-yellow-50 border-l-yellow-500 border border-yellow-200' :
                        'bg-blue-50 border-l-blue-500 border border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={
                                finding.severity === 'critical' ? 'border-red-500 text-red-700 bg-red-100' :
                                finding.severity === 'high' ? 'border-orange-500 text-orange-700 bg-orange-100' :
                                finding.severity === 'medium' ? 'border-yellow-500 text-yellow-700 bg-yellow-100' :
                                'border-blue-500 text-blue-700 bg-blue-100'
                              }
                            >
                              {finding.severity.toUpperCase()}
                            </Badge>
                            {finding.cvssScore && (
                              <Badge variant="outline" className="border-muted text-muted-foreground">
                                CVSS {finding.cvssScore}
                              </Badge>
                            )}
                            {finding.cveId && (
                              <Badge variant="outline" className="border-muted text-muted-foreground">
                                {finding.cveId}
                              </Badge>
                            )}
                          </div>
                          <h5 className="font-medium text-foreground mb-1">{finding.title}</h5>
                          <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                          {finding.evidence && (
                            <p className="text-xs text-muted-foreground mb-2 font-mono bg-background/50 p-2 rounded">
                              Evidence: {finding.evidence}
                            </p>
                          )}
                          <p className="text-sm text-foreground font-medium">
                            <span className="text-muted-foreground">Fix:</span> {finding.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {result.securityFindings.length > 8 && (
                    <div className="text-center p-3 bg-background/50 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        And {result.securityFindings.length - 8} more security issues found...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing Security Headers */}
            {result.missingSecurityHeaders && result.missingSecurityHeaders.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground text-sm">Missing Security Headers</h4>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {result.missingSecurityHeaders.map((header, index) => (
                      <Badge key={index} variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-100">
                        {header}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-yellow-700">
                    Missing security headers leave your website vulnerable to various attacks including XSS, clickjacking, and data injection.
                  </p>
                </div>
              </div>
            )}

            {/* WordPress Security Issues */}
            {result.isWordPress && result.wpSecurityIssues && result.wpSecurityIssues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground text-sm">WordPress Security Issues</h4>
                <div className="space-y-2">
                  {result.wpSecurityIssues.slice(0, 5).map((issue, index) => (
                    <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className="border-orange-500 text-orange-700">
                          {issue.severity?.toUpperCase() || 'MEDIUM'}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">{issue.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

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
              <span>Revenue Impact Assessment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Desktop Performance</span>
              <div className="flex items-center space-x-2">
                {getScoreIcon(result.performanceScore)}
                <span className={`font-bold ${getScoreColor(result.performanceScore)}`}>
                  {result.performanceScore}/100
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Mobile Conversion Risk</span>
              <div className="flex items-center space-x-2">
                {getScoreIcon(result.mobileScore)}
                <span className={`font-bold ${getScoreColor(result.mobileScore)}`}>
                  {result.mobileScore}/100
                </span>
              </div>
            </div>
            {result.performanceScore < 70 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700">
                  ⚠️ Performance issues may be costing you up to 25% of potential conversions
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-primary" />
              <span>Security Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.overallSecurityScore !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-foreground">Security Score</span>
                <div className="flex items-center space-x-2">
                  {getScoreIcon(result.overallSecurityScore)}
                  <span className={`font-bold ${getScoreColor(result.overallSecurityScore)}`}>
                    {result.overallSecurityScore}/100
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-foreground">SSL Certificate</span>
              <div className="flex items-center space-x-1">
                {result.hasSSL ? <Lock className="w-4 h-4 text-success" /> : <Unlock className="w-4 h-4 text-destructive" />}
                {getStatusBadge(result.hasSSL)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">CDN Protection</span>
              {getStatusBadge(result.hasCDN)}
            </div>
            {result.securityFindings && result.securityFindings.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-foreground">Security Issues Found</span>
                <Badge variant="outline" className="border-destructive text-destructive">
                  {result.securityFindings.length} issues
                </Badge>
              </div>
            )}
            {result.missingSecurityHeaders && result.missingSecurityHeaders.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-foreground">Missing Security Headers</span>
                <Badge variant="outline" className="border-warning text-warning">
                  {result.missingSecurityHeaders.length} headers
                </Badge>
              </div>
            )}
            {(!result.hasSSL || (result.securityFindings && result.securityFindings.some(f => f.severity === 'critical' || f.severity === 'high'))) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  Critical security vulnerabilities detected that require immediate attention
                </p>
              </div>
            )}
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

      {/* Critical Actions Required */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Critical Actions Required</CardTitle>
          <p className="text-sm text-muted-foreground">
            Priority fixes to protect your business and improve conversions
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start space-x-3 p-3 border border-orange-200 rounded-lg bg-orange-90">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-foreground font-medium">{rec}</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Action item #{index + 1} - Address this to reduce business risk
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="bg-card/80 from-destructive/10 to-orange-100 border-orange-200">
        <CardContent className="p-8 text-center space-y-6">
          <h3 className="text-2xl font-bold text-foreground">
            Don't Let These Issues Cost You Business
          </h3>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every day these security vulnerabilities and performance issues remain unfixed, 
            you're losing potential customers and putting your business at risk.
          </p>
          <div className="bg-card/80 border border-orange-200 rounded-lg p-6 max-w-md mx-auto">
            <h4 className="font-semibold text-foreground mb-2">Free Security Consultation</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Get a personalized action plan to fix these critical issues
            </p>
            <div className="flex flex-col gap-3">
              <Button size="lg" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                <a href="mailto:hal.webtech@gmail.com?subject=URGENT: Security Issues Found - Schedule Consultation">
                  Fix These Issues Now
                </a>
              </Button>
              <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                <a href="mailto:hal.webtech@gmail.com?subject=Question About Security Report">
                  Ask Questions About This Report
                </a>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll prioritize your most critical security and performance issues
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisResults;
