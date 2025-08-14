// Performance analysis utilities

export interface PerformanceScores {
  performanceScore: number;
  mobileScore: number;
  usingRealData: boolean;
}

// PageSpeed Insights API integration
export async function getPageSpeedScores(normalizedUrl: string): Promise<PerformanceScores> {
  let performanceScore = 65; // More realistic fallback score
  let mobileScore = 55; // More realistic fallback score
  let usingRealData = false;
  
  // Get Google PageSpeed API key from Supabase secrets
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SPEED_TEST_KEY');
  console.log(`🔑 Google PageSpeed API Key available: ${GOOGLE_API_KEY ? 'YES' : 'NO'}`);
  
  if (GOOGLE_API_KEY && GOOGLE_API_KEY.trim()) {
    console.log(`Starting PageSpeed analysis for ${normalizedUrl}`);
    
    // Helper function to make PageSpeed API calls with enhanced error handling
    const fetchPageSpeedWithRetry = async (strategy: 'desktop' | 'mobile', maxRetries = 3): Promise<{ score: number | null, error?: string }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries} for ${strategy} strategy`);
          
          const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&category=performance&strategy=${strategy}&key=${GOOGLE_API_KEY}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Website-Analyzer/1.0)',
              'Accept': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log(`${strategy} PageSpeed API response: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.lighthouseResult?.categories?.performance?.score !== undefined) {
              const score = Math.round(data.lighthouseResult.categories.performance.score * 100);
              console.log(`✅ ${strategy} PageSpeed score: ${score}`);
              return { score };
            } else {
              console.warn(`${strategy} API response missing performance score`);
              return { score: null, error: 'Missing score data in response' };
            }
          } else if (response.status === 429) {
            const waitTime = Math.min(Math.pow(2, attempt) * 2000, 10000); // Exponential backoff, cap at 10 seconds
            console.log(`Rate limited on attempt ${attempt}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (response.status === 400) {
            const errorText = await response.text();
            console.error(`${strategy} API bad request:`, errorText.substring(0, 200));
            return { score: null, error: `Bad request: ${errorText}` };
          } else {
            const errorText = await response.text();
            console.error(`${strategy} API error ${response.status}:`, errorText.substring(0, 200));
            if (attempt === maxRetries) {
              return { score: null, error: `HTTP ${response.status}: ${errorText}` };
            }
          }
        } catch (error) {
          console.error(`${strategy} attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');
          if (error instanceof Error && error.name === 'AbortError') {
            console.error(`${strategy} request timed out`);
            return { score: null, error: 'Request timeout' };
          }
          
          if (attempt === maxRetries) {
            return { score: null, error: error instanceof Error ? error.message : 'Unknown error' };
          }
          
          // Wait before retry
          const waitTime = Math.min(Math.pow(2, attempt) * 1500, 6000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      return { score: null, error: 'Max retries exceeded' };
    };
    
    try {
      console.log('Starting PageSpeed API calls...');
      
      // Fetch desktop score first
      const desktopResult = await fetchPageSpeedWithRetry('desktop');
      
      // Delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mobileResult = await fetchPageSpeedWithRetry('mobile');
      
      console.log('PageSpeed API Results:');
      console.log(`Desktop: ${desktopResult.score !== null ? desktopResult.score : 'Failed'}`);
      console.log(`Mobile: ${mobileResult.score !== null ? mobileResult.score : 'Failed'}`);
      
      // Use real data if available
      if (desktopResult.score !== null) {
        performanceScore = desktopResult.score;
        usingRealData = true;
      }
      
      if (mobileResult.score !== null) {
        mobileScore = mobileResult.score;
        usingRealData = true;
      }
      
      if (usingRealData) {
        console.log(`Using real PageSpeed data - Desktop: ${performanceScore}, Mobile: ${mobileScore}`);
      } else {
        console.log('PageSpeed API calls failed, using estimated scores');
      }
      
    } catch (error) {
      console.error('PageSpeed API request failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  } else {
    console.log('No Google PageSpeed API key configured, using estimated scores');
  }

  return { performanceScore, mobileScore, usingRealData };
}

export function calculateEstimatedScores(analysisData: {
  hasSSL: boolean;
  hasCDN: boolean;
  caching: 'enabled' | 'partial' | 'disabled';
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
  plugins: number;
  isWordPress: boolean;
}): { performanceScore: number; mobileScore: number } {
  console.log('Computing estimated performance scores based on technical analysis');
  
  // Start with realistic base score
  let baseScore = 50;
  
  // Positive factors
  if (analysisData.hasSSL) {
    baseScore += 5;
  }
  if (analysisData.hasCDN) {
    baseScore += 8;
  }
  if (analysisData.caching === 'enabled') {
    baseScore += 10;
  } else if (analysisData.caching === 'partial') {
    baseScore += 5;
  }
  if (analysisData.imageOptimization === 'good') {
    baseScore += 8;
  } else if (analysisData.imageOptimization === 'needs-improvement') {
    baseScore += 3;
  }
  
  // Negative factors
  if (analysisData.plugins > 25) {
    baseScore -= 15;
  } else if (analysisData.plugins > 15) {
    baseScore -= 10;
  } else if (analysisData.plugins > 10) {
    baseScore -= 5;
  }
  
  // WordPress penalty
  if (analysisData.isWordPress) {
    baseScore -= 8;
  }
  
  // Additional penalties
  if (!analysisData.hasCDN && !analysisData.hasSSL) {
    baseScore -= 5;
  }
  
  // Keep scores in realistic ranges
  const performanceScore = Math.min(Math.max(baseScore, 25), 85);
  const mobileScore = Math.max(20, performanceScore - Math.floor(Math.random() * 10 + 10));
  
  console.log(`Estimated scores - Desktop: ${performanceScore}, Mobile: ${mobileScore}`);

  return { performanceScore, mobileScore };
}

export function generateRecommendations(analysisData: {
  performanceScore: number;
  hasCDN: boolean;
  caching: 'enabled' | 'partial' | 'disabled';
  hasSSL: boolean;
  isWordPress: boolean;
  plugins: number;
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
}): string[] {
  const recommendations: string[] = [];
  
  if (analysisData.performanceScore < 80) {
    recommendations.push("Improve page loading speed by optimizing images and reducing server response time");
  }
  
  if (!analysisData.hasCDN) {
    recommendations.push("Implement a Content Delivery Network (CDN) to improve global loading speeds");
  }
  
  if (analysisData.caching === 'disabled') {
    recommendations.push("Enable caching to improve page load times and reduce server load");
  }
  
  if (!analysisData.hasSSL) {
    recommendations.push("Install an SSL certificate to secure your website and improve SEO ranking");
  }
  
  if (analysisData.isWordPress) {
    recommendations.push("Keep WordPress core, themes, and plugins updated for security and performance");
    
    if (analysisData.plugins > 20) {
      recommendations.push("Review and deactivate unnecessary plugins to improve performance");
    }
  }

  if (analysisData.imageOptimization !== 'good') {
    recommendations.push("Optimize images by compressing and using modern formats like WebP");
  }

  // Add general recommendations if needed
  if (recommendations.length < 3) {
    recommendations.push("Minify CSS, JavaScript, and HTML files to reduce file sizes");
    recommendations.push("Optimize database and remove unnecessary data");
    recommendations.push("Use a performance-optimized hosting provider");
  }

  return recommendations.slice(0, 6);
}
