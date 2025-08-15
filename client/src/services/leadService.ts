export interface LeadData {
  name: string;
  email: string;
  company?: string;
  websiteUrl: string;
}

export interface AnalysisReportData {
  leadId: string;
  url: string;
  performanceScore?: number;
  mobileScore?: number;
  isWordpress?: boolean;
  wpVersion?: string;
  theme?: string;
  plugins?: number;
  hasSSL?: boolean;
  hasCDN?: boolean;
  imageOptimization?: 'good' | 'needs-improvement' | 'poor';
  caching?: 'enabled' | 'partial' | 'disabled';
  recommendations?: string[];
  technologies?: Array<{
    name: string;
    confidence: number;
    version?: string;
    category: string;
  }>;
  dataSource?: 'real' | 'estimated';
  confidence?: 'high' | 'medium' | 'low';
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
}

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const leadService = {
  async createLead(leadData: LeadData) {
    try {
      console.log('Creating lead with data:', leadData);
      
      const lead = await apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: leadData.name,
          email: leadData.email,
          company: leadData.company || null,
          websiteUrl: leadData.websiteUrl
        }),
      });

      console.log('Lead created successfully:', lead);
      return lead;
    } catch (error) {
      console.error('Lead creation error:', error);
      throw error;
    }
  },

  async createAnalysisReport(reportData: AnalysisReportData) {
    try {
      const report = await apiRequest('/api/analysis-reports', {
        method: 'POST',
        body: JSON.stringify({
          leadId: reportData.leadId,
          url: reportData.url,
          performanceScore: reportData.performanceScore,
          mobileScore: reportData.mobileScore,
          isWordpress: reportData.isWordpress || false,
          wpVersion: reportData.wpVersion,
          theme: reportData.theme,
          plugins: reportData.plugins,
          hasSSL: reportData.hasSSL || false,
          hasCDN: reportData.hasCDN || false,
          imageOptimization: reportData.imageOptimization,
          caching: reportData.caching,
          recommendations: reportData.recommendations,
          technologies: reportData.technologies,
          dataSource: reportData.dataSource,
          confidence: reportData.confidence,
          riskLevel: reportData.riskLevel
        }),
      });

      return report;
    } catch (error) {
      console.error('Analysis report creation error:', error);
      throw error;
    }
  },

  calculateRiskLevel(result: any): 'critical' | 'high' | 'medium' | 'low' {
    let riskScore = 0;
    
    // Performance risks
    if (result.performanceScore < 50) riskScore += 3;
    else if (result.performanceScore < 70) riskScore += 2;
    else if (result.performanceScore < 90) riskScore += 1;
    
    // Security risks
    if (!result.hasSSL) riskScore += 3;
    if (result.isWordPress && !result.wpVersion) riskScore += 2;
    
    // Optimization risks
    if (result.imageOptimization === 'poor') riskScore += 2;
    else if (result.imageOptimization === 'needs-improvement') riskScore += 1;
    
    if (result.caching === 'disabled') riskScore += 2;
    else if (result.caching === 'partial') riskScore += 1;
    
    // Mobile risks
    if (result.mobileScore < 50) riskScore += 2;
    else if (result.mobileScore < 70) riskScore += 1;
    
    if (riskScore >= 7) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }
};