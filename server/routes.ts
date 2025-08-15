import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertAnalysisReportSchema } from "@shared/schema";

// Website analysis service
interface AnalysisResult {
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
  technologies: Technology[];
  dataSource: 'real' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  analysisTimestamp: string;
}

interface Technology {
  name: string;
  confidence: number;
  version?: string;
  category: string;
}

// Analysis service functionality
function validateUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  try {
    if (url.length > 2048) {
      return { isValid: false, error: 'URL too long' };
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Invalid protocol' };
    }

    return { isValid: true, normalizedUrl };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

function detectWordPress(html: string): boolean {
  const htmlLower = html.toLowerCase();
  const wpIndicators = [
    '/wp-content/',
    '/wp-includes/',
    'wp-json',
    'wordpress',
    'wp_enqueue_script',
    'wp-admin'
  ];
  return wpIndicators.some(indicator => htmlLower.includes(indicator));
}

function calculateRiskLevel(result: AnalysisResult): 'critical' | 'high' | 'medium' | 'low' {
  let score = 0;
  
  // Performance factors
  if (result.performanceScore < 50) score += 3;
  else if (result.performanceScore < 70) score += 2;
  else if (result.performanceScore < 80) score += 1;
  
  // Security factors
  if (!result.hasSSL) score += 3;
  if (!result.hasCDN) score += 1;
  if (result.caching === 'disabled') score += 2;
  
  // WordPress specific risks
  if (result.isWordPress) {
    if ((result.plugins || 0) > 20) score += 2;
    if (result.wpVersion && parseFloat(result.wpVersion) < 6.0) score += 2;
  }
  
  if (score >= 6) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  const validation = validateUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid URL');
  }

  const normalizedUrl = validation.normalizedUrl!;
  
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Website-Analyzer/1.0)',
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const headers = Object.fromEntries(response.headers.entries());

    // Basic analysis
    const isWordPress = detectWordPress(html);
    const hasSSL = normalizedUrl.startsWith('https://');
    const hasCDN = html.toLowerCase().includes('cloudflare') || html.toLowerCase().includes('cloudfront');
    
    // Generate estimated scores
    let performanceScore = 65;
    let mobileScore = 55;
    
    if (hasSSL) performanceScore += 5;
    if (hasCDN) performanceScore += 10;
    if (isWordPress) performanceScore -= 8;
    
    mobileScore = Math.max(20, performanceScore - Math.floor(Math.random() * 15 + 5));
    
    const result: AnalysisResult = {
      url: normalizedUrl,
      performanceScore: Math.min(Math.max(performanceScore, 25), 95),
      mobileScore: Math.min(Math.max(mobileScore, 20), 90),
      isWordPress,
      hasSSL,
      hasCDN,
      imageOptimization: 'needs-improvement' as const,
      caching: hasCDN ? 'partial' as const : 'disabled' as const,
      recommendations: [
        'Improve page loading speed by optimizing images',
        'Implement a Content Delivery Network (CDN)',
        'Enable browser caching for better performance',
        'Optimize CSS and JavaScript files'
      ],
      technologies: [
        { name: 'HTTPS', confidence: hasSSL ? 100 : 0, category: 'Security' },
        ...(isWordPress ? [{ name: 'WordPress', confidence: 90, category: 'CMS' }] : [])
      ],
      dataSource: 'estimated' as const,
      confidence: 'medium' as const,
      analysisTimestamp: new Date().toISOString()
    };

    return result;
  } catch (error) {
    throw new Error('Failed to analyze website. Please check the URL and try again.');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Lead creation endpoint
  app.post('/api/leads', async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      console.error('Lead creation error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to create lead' 
      });
    }
  });

  // Website analysis endpoint
  app.post('/api/analyze', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const result = await analyzeWebsite(url);
      res.json(result);
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      });
    }
  });

  // Analysis report creation endpoint
  app.post('/api/analysis-reports', async (req, res) => {
    try {
      const reportData = insertAnalysisReportSchema.parse(req.body);
      const report = await storage.createAnalysisReport(reportData);
      res.json(report);
    } catch (error) {
      console.error('Report creation error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to create analysis report' 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
