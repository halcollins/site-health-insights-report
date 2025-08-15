// Type definitions for the analysis service

export interface PageSpeedResult {
  lighthouseResult: {
    categories: {
      performance: { score: number };
      accessibility: { score: number };
      'best-practices': { score: number };
      seo: { score: number };
    };
    audits: {
      'first-contentful-paint': { displayValue: string };
      'largest-contentful-paint': { displayValue: string };
      'cumulative-layout-shift': { displayValue: string };
    };
  };
}

export interface WordPressDetectionResult {
  isWordPress: boolean;
  wpVersion?: string;
  theme?: string;
  plugins?: number;
  hasSSL: boolean;
  hasCDN: boolean;
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
  caching: 'enabled' | 'partial' | 'disabled';
}

export interface Technology {
  name: string;
  confidence: number;
  version?: string;
  category: string;
}

export interface AnalysisResult {
  url: string;
  performanceScore: number;
  mobileScore: number;
  isWordPress: boolean;
  wpVersion?: string;
  theme?: string;
  plugins?: number;
  hasSSL: boolean;
  hasCDN: boolean;
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
  caching: 'enabled' | 'partial' | 'disabled';
  recommendations: string[];
  technologies?: Technology[];
  dataSource: 'real' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  analysisTimestamp: string;
}