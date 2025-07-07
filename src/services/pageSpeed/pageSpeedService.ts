import { PageSpeedResult } from '../types/analysisTypes';

export class PageSpeedService {
  private readonly PAGESPEED_API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  async getPageSpeedInsights(url: string): Promise<PageSpeedResult> {
    const apiUrl = `${this.PAGESPEED_API_BASE}?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=desktop`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`);
    }
    
    return response.json();
  }

  async getGTMetrixInsights(url: string): Promise<PageSpeedResult> {
    // SECURITY: GTMetrix API credentials should be stored securely in Supabase secrets
    // Using localStorage for API credentials is a security risk
    console.warn('GTMetrix integration disabled for security - credentials should not be stored in localStorage');
    throw new Error('GTMetrix integration has been disabled for security reasons. Please use Supabase Edge Functions for secure API credential storage.');
  }
}

export const pageSpeedService = new PageSpeedService();