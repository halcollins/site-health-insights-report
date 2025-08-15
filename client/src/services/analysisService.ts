import { AnalysisResult } from './types/analysisTypes';

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

class AnalysisService {
  async analyzeWebsite(url: string): Promise<AnalysisResult> {
    try {
      console.log(`Starting server-side analysis for: ${url}`);
      
      const result = await apiRequest('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      console.log('Analysis completed successfully:', result);
      return result as AnalysisResult;
    } catch (error) {
      console.error('Analysis service error:', error);
      throw new Error('Unable to analyze the website. Please verify the URL is accessible and try again.');
    }
  }
}

export const analysisService = new AnalysisService();
export type { AnalysisResult };