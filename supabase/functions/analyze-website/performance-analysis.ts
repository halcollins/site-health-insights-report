// Performance analysis utilities

export interface PerformanceScores {
  performanceScore: number;
  mobileScore: number;
  usingRealData: boolean;
}

// PageSpeed Insights API integration
export async function getPageSpeedScores(normalizedUrl: string): Promise<PerformanceScores> {
  let performanceScore = 75; // Fallback score
  let mobileScore = 65; // Fallback score
  let usingRealData = false;
  
  // Get Google PageSpeed API key from Supabase secrets
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SPEED_TEST_KEY');
  console.log(`Google API Key present: ${GOOGLE_API_KEY ? 'YES' : 'NO'}`);
  
  if (GOOGLE_API_KEY) {
    console.log(`Starting PageSpeed analysis for ${normalizedUrl}`);
    
    // Helper function to make PageSpeed API calls with enhanced error handling
    const fetchPageSpeedWithRetry = async (strategy: 'desktop' | 'mobile', maxRetries = 2): Promise<{ score: number | null, error?: string }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries} for ${strategy} strategy`);
          
          const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&category=performance&strategy=${strategy}&key=${GOOGLE_API_KEY}`;
          console.log(`API URL constructed for ${strategy}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
          
          const response = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Website-Analyzer/1.0',
              'Accept': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log(`${strategy} API response - Status: ${response.status}, OK: ${response.ok}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`${strategy} API response data keys:`, Object.keys(data));
            
            if (data.lighthouseResult?.categories?.performance?.score !== undefined) {
              const score = Math.round(data.lighthouseResult.categories.performance.score * 100);
              console.log(`✅ ${strategy} PageSpeed score: ${score}`);
              return { score };
            } else {
              console.error(`❌ ${strategy} API response missing score data`);
              return { score: null, error: 'Missing score data in response' };
            }
          } else if (response.status === 429) {
            const waitTime = Math.min(Math.pow(2, attempt) * 1000, 8000); // Cap at 8 seconds
            console.log(`⏳ Rate limited on attempt ${attempt}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (response.status === 400) {
            const errorText = await response.text();
            console.error(`❌ ${strategy} API bad request (400):`, errorText);
            return { score: null, error: `Bad request: ${errorText}` };
          } else {
            const errorText = await response.text();
            console.error(`❌ ${strategy} API error ${response.status}:`, errorText);
            if (attempt === maxRetries) {
              return { score: null, error: `HTTP ${response.status}: ${errorText}` };
            }
          }
        } catch (error) {
          console.error(`❌ ${strategy} attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');
          if (error instanceof Error && error.name === 'AbortError') {
            console.error(`${strategy} request timed out`);
            return { score: null, error: 'Request timeout' };
          }
          
          if (attempt === maxRetries) {
            return { score: null, error: error instanceof Error ? error.message : 'Unknown error' };
          }
          
          // Wait before retry
          const waitTime = Math.min(Math.pow(2, attempt) * 1000, 5000);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      return { score: null, error: 'Max retries exceeded' };
    };
    
    try {
      console.log('🚀 Starting parallel PageSpeed API calls...');
      
      // Fetch both scores with staggered timing to avoid rate limits 
      const desktopResult = await fetchPageSpeedWithRetry('desktop');
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mobileResult = await fetchPageSpeedWithRetry('mobile');
      
      console.log('📊 PageSpeed API Results:');
      console.log(`Desktop: ${desktopResult.score !== null ? desktopResult.score : `Failed - ${desktopResult.error}`}`);
      console.log(`Mobile: ${mobileResult.score !== null ? mobileResult.score : `Failed - ${mobileResult.error}`}`);
      
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
        console.log(`✅ Using REAL PageSpeed data - Desktop: ${performanceScore}, Mobile: ${mobileScore}`);
      } else {
        console.log(`⚠️ All PageSpeed API calls failed, using estimated scores`);
        console.log(`Errors - Desktop: ${desktopResult.error}, Mobile: ${mobileResult.error}`);
      }
      
    } catch (error) {
      console.error('❌ PageSpeed API batch request failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  } else {
    console.log('⚠️ No Google API key found in secrets, using estimated scores');
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
  console.log('🔢 Computing realistic estimated performance scores based on technical analysis');
  
  // Start with much lower base score to match real-world PageSpeed distributions
  let baseScore = 45; // Much more realistic baseline
  
  // Smaller, more realistic positive factors
  if (analysisData.hasSSL) {
    baseScore += 3;
    console.log('✅ SSL enabled: +3 points');
  }
  if (analysisData.hasCDN) {
    baseScore += 6;
    console.log('✅ CDN detected: +6 points');
  }
  if (analysisData.caching === 'enabled') {
    baseScore += 8;
    console.log('✅ Caching enabled: +8 points');
  } else if (analysisData.caching === 'partial') {
    baseScore += 4;
    console.log('⚠️ Partial caching: +4 points');
  }
  if (analysisData.imageOptimization === 'good') {
    baseScore += 6;
    console.log('✅ Good image optimization: +6 points');
  } else if (analysisData.imageOptimization === 'needs-improvement') {
    baseScore += 2;
    console.log('⚠️ Image optimization needs work: +2 points');
  }
  
  // Stronger negative impacts to reflect reality
  if (analysisData.plugins > 25) {
    baseScore -= 20;
    console.log(`❌ Too many plugins (${analysisData.plugins}): -20 points`);
  } else if (analysisData.plugins > 15) {
    baseScore -= 12;
    console.log(`⚠️ Many plugins (${analysisData.plugins}): -12 points`);
  } else if (analysisData.plugins > 10) {
    baseScore -= 8;
    console.log(`⚠️ Several plugins (${analysisData.plugins}): -8 points`);
  }
  
  // WordPress penalty reflects real performance impact
  if (analysisData.isWordPress) {
    baseScore -= 12; // WordPress sites typically score much lower
    console.log('⚠️ WordPress site: -12 points');
  }
  
  // Additional realistic penalties
  if (!analysisData.hasCDN && !analysisData.hasSSL) {
    baseScore -= 8; // Multiple basic issues compound
    console.log('❌ Missing basic optimizations: -8 points');
  }
  
  // Keep scores in realistic ranges - PageSpeed scores are typically much lower
  const performanceScore = Math.min(Math.max(baseScore, 20), 75); // Cap much lower
  const mobileScore = Math.max(15, performanceScore - Math.floor(Math.random() * 8 + 12)); // Mobile typically 12-20 points lower
  
  console.log(`📊 Realistic estimated scores - Desktop: ${performanceScore}, Mobile: ${mobileScore}`);
  console.log('⚠️ Using estimated scores - results may differ from actual PageSpeed testing');

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
