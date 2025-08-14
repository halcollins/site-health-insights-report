import { supabase } from "@/integrations/supabase/client";

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

export const leadService = {
  async createLead(leadData: LeadData) {
    try {
      console.log('Attempting to create lead with data:', leadData);
      
      // Check current auth state
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current auth session:', session);
      console.log('Session error:', sessionError);
      
      const insertData = {
        name: leadData.name,
        email: leadData.email,
        company: leadData.company || null,
        website_url: leadData.websiteUrl
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('leads')
        .insert(insertData)
        .select()
        .single();

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error creating lead:', error);
        throw new Error(`Failed to create lead: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Lead service error:', error);
      throw error;
    }
  },

  async createAnalysisReport(reportData: AnalysisReportData) {
    try {
      const { data, error } = await supabase
        .from('analysis_reports')
        .insert({
          lead_id: reportData.leadId,
          url: reportData.url,
          performance_score: reportData.performanceScore,
          mobile_score: reportData.mobileScore,
          is_wordpress: reportData.isWordpress || false,
          wp_version: reportData.wpVersion,
          theme: reportData.theme,
          plugins: reportData.plugins,
          has_ssl: reportData.hasSSL || false,
          has_cdn: reportData.hasCDN || false,
          image_optimization: reportData.imageOptimization,
          caching: reportData.caching,
          recommendations: reportData.recommendations,
          technologies: reportData.technologies,
          data_source: reportData.dataSource,
          confidence: reportData.confidence,
          risk_level: reportData.riskLevel
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating analysis report:', error);
        throw new Error('Failed to create analysis report');
      }

      return data;
    } catch (error) {
      console.error('Analysis report service error:', error);
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