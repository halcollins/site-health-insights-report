import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// All code consolidated into single file to fix import issues

// ============= TYPES =============
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
  technologies: Technology[];
  dataSource: 'real' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  analysisTimestamp: string;
}

export interface Technology {
  name: string;
  confidence: number;
  version?: string;
  category: string;
}

export interface PerformanceScores {
  performanceScore: number;
  mobileScore: number;
  usingRealData: boolean;
}

// ============= VALIDATION =============
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 15,
  MAX_URL_LENGTH: 2048,
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  BLOCKED_DOMAINS: ['localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.169.254'],
  BLOCKED_TLDS: ['.local', '.internal'],
};

function validateAndSanitizeUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  try {
    if (url.length > SECURITY_CONFIG.MAX_URL_LENGTH) {
      return { isValid: false, error: 'URL too long' };
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);

    if (!SECURITY_CONFIG.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { isValid: false, error: 'Invalid protocol' };
    }

    const hostname = urlObj.hostname.toLowerCase();
    if (SECURITY_CONFIG.BLOCKED_DOMAINS.some(blocked => 
      hostname === blocked || hostname.includes(blocked)
    )) {
      return { isValid: false, error: 'Access to internal/local resources not allowed' };
    }

    if (SECURITY_CONFIG.BLOCKED_TLDS.some(tld => hostname.endsWith(tld))) {
      return { isValid: false, error: 'Access to internal domains not allowed' };
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      
      if (parts.some(part => part < 0 || part > 255)) {
        return { isValid: false, error: 'Invalid IP address format' };
      }
      
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 127) ||
        (parts[0] === 169 && parts[1] === 254)
      ) {
        return { isValid: false, error: 'Access to private IP ranges not allowed' };
      }
    }

    return { isValid: true, normalizedUrl };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining?: number } {
  const now = Date.now();
  const key = clientIP.substring(0, 15);
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 });
    return { allowed: true, remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - 1 };
  }

  if (limit.count < SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    limit.count++;
    return { allowed: true, remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - limit.count };
  }

  return { allowed: false };
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const safeErrors = [
      'URL too long',
      'Invalid protocol', 
      'Invalid URL format',
      'Access to internal/local resources not allowed',
      'Access to internal domains not allowed',
      'Access to private IP ranges not allowed',
      'Rate limit exceeded'
    ];
    
    if (safeErrors.includes(error.message)) {
      return error.message;
    }
  }
  
  return 'Analysis failed. Please check the URL and try again.';
}

// ============= CACHING =============
const resultCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

function getCachedResult(cacheKey: string): any | null {
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
    console.log(`✅ Returning cached result for ${cacheKey}`);
    return cachedResult.result;
  }
  return null;
}

function setCachedResult(cacheKey: string, result: any): void {
  resultCache.set(cacheKey, { result, timestamp: Date.now() });
  console.log(`💾 Cached result for ${cacheKey}`);
}

// ============= TECHNOLOGY DETECTION =============
function detectWordPress(html: string, headers: Record<string, string>) {
  const htmlLower = html.toLowerCase();
  const wpIndicators = [
    '/wp-content/',
    '/wp-includes/',
    'wp-json',
    'wordpress',
    'wp_enqueue_script',
    'wp-admin'
  ];

  const hasWpContent = wpIndicators.some(indicator => htmlLower.includes(indicator));
  const wpHeaders = Object.values(headers).some(value => 
    value.toLowerCase().includes('wordpress')
  );

  return hasWpContent || wpHeaders;
}

function extractWordPressVersion(html: string): string | undefined {
  const versionMatch = html.match(/wp-includes\/js\/wp-emoji-release\.min\.js\?ver=([0-9.]+)/);
  if (versionMatch) return versionMatch[1];

  const metaMatch = html.match(/<meta name="generator" content="WordPress ([0-9.]+)"/);
  if (metaMatch) return metaMatch[1];

  return undefined;
}

function extractThemeName(html: string): string | undefined {
  const themeMatch = html.match(/\/wp-content\/themes\/([^\/\?'"]+)/);
  if (themeMatch) {
    return themeMatch[1].charAt(0).toUpperCase() + themeMatch[1].slice(1);
  }
  return undefined;
}

function countPlugins(html: string): number {
  const pluginMatches = html.match(/\/wp-content\/plugins\/([^\/\?'"]+)/g);
  if (pluginMatches) {
    const uniquePlugins = new Set(pluginMatches.map(match => match.split('/')[3]));
    return uniquePlugins.size;
  }
  return 0;
}

function detectCDN(html: string, headers: Record<string, string>): boolean {
  const cdnIndicators = [
    'cloudflare', 'cloudfront', 'fastly', 'maxcdn', 'keycdn', 
    'jsdelivr', 'unpkg', 'cdnjs', 'bootstrapcdn'
  ];

  const htmlLower = html.toLowerCase();
  const headerValues = Object.values(headers).join(' ').toLowerCase();

  return cdnIndicators.some(cdn => 
    htmlLower.includes(cdn) || headerValues.includes(cdn)
  );
}

function analyzeCaching(headers: Record<string, string>): 'enabled' | 'partial' | 'disabled' {
  const cacheHeaders = ['cache-control', 'expires', 'etag', 'last-modified'];
  const foundHeaders = cacheHeaders.filter(header => headers[header]);

  if (foundHeaders.length >= 3) return 'enabled';
  if (foundHeaders.length >= 1) return 'partial';
  return 'disabled';
}

function analyzeImageOptimization(html: string): 'good' | 'needs-improvement' | 'poor' {
  const images = html.match(/<img[^>]+>/g) || [];
  if (images.length === 0) return 'good';

  const webpImages = images.filter(img => img.includes('.webp')).length;
  const totalImages = images.length;
  const webpRatio = webpImages / totalImages;

  if (webpRatio > 0.7) return 'good';
  if (webpRatio > 0.3) return 'needs-improvement';
  return 'poor';
}

async function getBuiltWithTechnologies(domain: string): Promise<Technology[]> {
  try {
    const BUILTWITH_API_KEY = Deno.env.get('BUILTWITH_API_KEY');
    
    if (!BUILTWITH_API_KEY || !BUILTWITH_API_KEY.trim()) {
      console.log('🔑 BuiltWith API key not configured, skipping BuiltWith detection');
      return [];
    }

    console.log(`Calling BuiltWith API for domain: ${domain}`);
    
    const apiUrl = `https://api.builtwith.com/free1/api.json?KEY=${BUILTWITH_API_KEY}&LOOKUP=${encodeURIComponent(domain)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Website-Analyzer/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.error(`BuiltWith API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const technologies: Technology[] = [];

    if (data.Results && data.Results[0] && data.Results[0].Result) {
      const result = data.Results[0].Result;
      
      Object.keys(result).forEach(category => {
        const categoryData = result[category];
        if (Array.isArray(categoryData)) {
          categoryData.forEach((tech: any) => {
            technologies.push({
              name: tech.Name || tech.Tag || 'Unknown',
              confidence: 85,
              version: tech.Version || undefined,
              category: category.replace(/([A-Z])/g, ' $1').trim()
            });
          });
        }
      });
    }

    console.log(`Found ${technologies.length} technologies via BuiltWith`);
    return technologies;
  } catch (error) {
    console.error('BuiltWith API call failed:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

function detectTechnologiesCustom(html: string, headers: Record<string, string>): Technology[] {
  const technologies: Technology[] = [];
  const htmlLower = html.toLowerCase();

  if (detectWordPress(html, headers)) {
    const version = extractWordPressVersion(html);
    technologies.push({
      name: 'WordPress',
      confidence: 90,
      version,
      category: 'CMS'
    });
  }

  if (htmlLower.includes('react') || htmlLower.includes('_react')) {
    technologies.push({ name: 'React', confidence: 75, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('vue') || htmlLower.includes('vuejs')) {
    technologies.push({ name: 'Vue.js', confidence: 75, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('angular') || htmlLower.includes('ng-')) {
    technologies.push({ name: 'Angular', confidence: 75, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('jquery') || htmlLower.includes('jquery.min.js')) {
    technologies.push({ name: 'jQuery', confidence: 85, category: 'JavaScript libraries' });
  }

  if (htmlLower.includes('bootstrap') || htmlLower.includes('bootstrap.min.css')) {
    technologies.push({ name: 'Bootstrap', confidence: 80, category: 'CSS frameworks' });
  }
  if (htmlLower.includes('tailwind') || htmlLower.includes('tailwindcss')) {
    technologies.push({ name: 'Tailwind CSS', confidence: 80, category: 'CSS frameworks' });
  }

  if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag')) {
    technologies.push({ name: 'Google Analytics', confidence: 90, category: 'Analytics' });
  }
  
  if (htmlLower.includes('gtm') || htmlLower.includes('googletagmanager')) {
    technologies.push({ name: 'Google Tag Manager', confidence: 85, category: 'Tag managers' });
  }

  if (detectCDN(html, headers)) {
    technologies.push({ name: 'Content Delivery Network', confidence: 80, category: 'CDN' });
  }

  return technologies;
}

function mergeTechnologies(builtwithTech: Technology[], customTech: Technology[]): Technology[] {
  const merged = [...builtwithTech];
  const existingNames = new Set(builtwithTech.map(tech => tech.name.toLowerCase()));

  customTech.forEach(tech => {
    if (!existingNames.has(tech.name.toLowerCase())) {
      merged.push(tech);
    }
  });

  return merged
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20);
}

// ============= PERFORMANCE ANALYSIS =============
async function getPageSpeedScores(normalizedUrl: string): Promise<PerformanceScores> {
  let performanceScore = 65;
  let mobileScore = 55;
  let usingRealData = false;
  
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SPEED_TEST_KEY');
  console.log(`🔑 Google PageSpeed API Key available: ${GOOGLE_API_KEY ? 'YES' : 'NO'}`);
  
  if (GOOGLE_API_KEY && GOOGLE_API_KEY.trim()) {
    console.log(`Starting PageSpeed analysis for ${normalizedUrl}`);
    
    const fetchPageSpeedWithRetry = async (strategy: 'desktop' | 'mobile', maxRetries = 3): Promise<{ score: number | null, error?: string }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries} for ${strategy} strategy`);
          
          const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&category=performance&strategy=${strategy}&key=${GOOGLE_API_KEY}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
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
            const waitTime = Math.min(Math.pow(2, attempt) * 2000, 10000);
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
          
          const waitTime = Math.min(Math.pow(2, attempt) * 1500, 6000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      return { score: null, error: 'Max retries exceeded' };
    };
    
    try {
      console.log('Starting PageSpeed API calls...');
      
      const desktopResult = await fetchPageSpeedWithRetry('desktop');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mobileResult = await fetchPageSpeedWithRetry('mobile');
      
      console.log('PageSpeed API Results:');
      console.log(`Desktop: ${desktopResult.score !== null ? desktopResult.score : 'Failed'}`);
      console.log(`Mobile: ${mobileResult.score !== null ? mobileResult.score : 'Failed'}`);
      
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

function calculateEstimatedScores(analysisData: {
  hasSSL: boolean;
  hasCDN: boolean;
  caching: 'enabled' | 'partial' | 'disabled';
  imageOptimization: 'good' | 'needs-improvement' | 'poor';
  plugins: number;
  isWordPress: boolean;
}): { performanceScore: number; mobileScore: number } {
  console.log('Computing estimated performance scores based on technical analysis');
  
  let baseScore = 50;
  
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
  
  if (analysisData.plugins > 25) {
    baseScore -= 15;
  } else if (analysisData.plugins > 15) {
    baseScore -= 10;
  } else if (analysisData.plugins > 10) {
    baseScore -= 5;
  }
  
  if (analysisData.isWordPress) {
    baseScore -= 8;
  }
  
  if (!analysisData.hasCDN && !analysisData.hasSSL) {
    baseScore -= 5;
  }
  
  const performanceScore = Math.min(Math.max(baseScore, 25), 85);
  const mobileScore = Math.max(20, performanceScore - Math.floor(Math.random() * 10 + 10));
  
  console.log(`Estimated scores - Desktop: ${performanceScore}, Mobile: ${mobileScore}`);

  return { performanceScore, mobileScore };
}

function generateRecommendations(analysisData: {
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

  if (recommendations.length < 3) {
    recommendations.push("Minify CSS, JavaScript, and HTML files to reduce file sizes");
    recommendations.push("Optimize database and remove unnecessary data");
    recommendations.push("Use a performance-optimized hosting provider");
  }

  return recommendations.slice(0, 6);
}

// ============= MAIN HANDLER =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        details: 'Only POST requests are supported'
      }), 
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    console.log(`Request from IP: ${clientIP.substring(0, 10)}...`);

    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP.substring(0, 10)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: 'Too many requests. Please wait before trying again.'
        }), 
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          },
        }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: 'Request body must be valid JSON'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { url } = requestBody;
    
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'URL is required',
          details: 'Please provide a valid URL to analyze'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const urlValidation = validateAndSanitizeUrl(url);
    if (!urlValidation.isValid) {
      console.log(`Invalid URL: ${url}, Error: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ 
          error: sanitizeError(new Error(urlValidation.error || 'Invalid URL')),
          details: 'Please provide a valid public URL'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const normalizedUrl = urlValidation.normalizedUrl!;
    console.log(`Analyzing website: ${normalizedUrl}`);

    const cacheKey = normalizedUrl;
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      console.log(`Returning cached result for: ${normalizedUrl}`);
      return new Response(JSON.stringify(cachedResult), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Rate-Limit-Remaining': String(rateLimitCheck.remaining || 0)
        },
      });
    }

    const domain = new URL(normalizedUrl).hostname;
    console.log(`Extracted domain: ${domain}`);

    let html = '';
    let headers: Record<string, string> = {};
    
    try {
      console.log(`Fetching website content from: ${normalizedUrl}`);
      
      let response;
      try {
        response = await fetch(normalizedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Website-Analyzer/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          html = await response.text();
          response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
          });
          console.log(`Direct fetch successful for: ${normalizedUrl}`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (directError) {
        console.log(`Direct fetch failed: ${directError}, trying CORS proxy...`);
        
        const corsProxy = 'https://api.allorigins.win/get?url=';
        const proxyResponse = await fetch(`${corsProxy}${encodeURIComponent(normalizedUrl)}`, {
          signal: AbortSignal.timeout(20000)
        });
        
        if (!proxyResponse.ok) {
          throw new Error(`Proxy fetch failed: ${proxyResponse.status}`);
        }
        
        const proxyData = await proxyResponse.json();
        html = proxyData.contents || '';
        
        if (!html) {
          throw new Error('No content received from website');
        }
        
        console.log(`CORS proxy fetch successful for: ${normalizedUrl}`);
      }
    } catch (fetchError) {
      console.error(`Failed to fetch website content: ${fetchError}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch website',
          details: 'Unable to access the website. Please check the URL and try again.'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!html || html.length < 100) {
      console.error(`Insufficient content received from: ${normalizedUrl}`);
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient content',
          details: 'Unable to retrieve enough content from the website for analysis.'
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Content fetched successfully. Length: ${html.length} characters`);

    let builtwithTechnologies: any[] = [];
    let customTechnologies: any[] = [];
    let technologies: any[] = [];
    let isWordPress = false;
    let wpVersion: string | undefined;
    let theme: string | undefined;
    let plugins = 0;
    let hasSSL = false;
    let hasCDN = false;
    let imageOptimization: 'good' | 'needs-improvement' | 'poor' = 'needs-improvement';
    let caching: 'enabled' | 'partial' | 'disabled' = 'disabled';
    let performanceScore = 45;
    let mobileScore = 35;
    let usingRealData = false;
    let recommendations: string[] = [];

    try {
      console.log('Starting technology detection...');
      try {
        builtwithTechnologies = await getBuiltWithTechnologies(domain);
        console.log(`✅ BuiltWith API: ${builtwithTechnologies.length} technologies found`);
      } catch (error) {
        console.error('❌ BuiltWith API failed:', error instanceof Error ? error.message : 'Unknown error');
        builtwithTechnologies = [];
      }

      try {
        customTechnologies = detectTechnologiesCustom(html, headers);
        console.log(`✅ Custom detection: ${customTechnologies.length} technologies found`);
      } catch (error) {
        console.error('❌ Custom detection failed:', error instanceof Error ? error.message : 'Unknown error');
        customTechnologies = [];
      }

      try {
        technologies = mergeTechnologies(builtwithTechnologies, customTechnologies);
        console.log(`✅ Technology merge complete: ${technologies.length} total`);
      } catch (error) {
        console.error('❌ Technology merge failed:', error instanceof Error ? error.message : 'Unknown error');
        technologies = [...builtwithTechnologies, ...customTechnologies].slice(0, 10);
      }

      console.log('Starting WordPress analysis...');
      try {
        isWordPress = detectWordPress(html, headers);
        wpVersion = isWordPress ? extractWordPressVersion(html) : undefined;
        theme = isWordPress ? extractThemeName(html) : undefined;
        plugins = isWordPress ? countPlugins(html) : 0;
        console.log(`✅ WordPress analysis: ${isWordPress ? 'detected' : 'not detected'}, version: ${wpVersion || 'unknown'}, theme: ${theme || 'unknown'}, plugins: ${plugins}`);
      } catch (error) {
        console.error('❌ WordPress analysis failed:', error instanceof Error ? error.message : 'Unknown error');
        isWordPress = false;
        wpVersion = undefined;
        theme = undefined;
        plugins = 0;
      }

      console.log('Starting technical analysis...');
      try {
        hasSSL = normalizedUrl.startsWith('https://');
        hasCDN = detectCDN(html, headers);
        imageOptimization = analyzeImageOptimization(html);
        caching = analyzeCaching(headers);
        console.log(`✅ Technical analysis: SSL: ${hasSSL}, CDN: ${hasCDN}, Images: ${imageOptimization}, Caching: ${caching}`);
      } catch (error) {
        console.error('❌ Technical analysis failed:', error instanceof Error ? error.message : 'Unknown error');
        hasSSL = normalizedUrl.startsWith('https://');
        hasCDN = false;
        imageOptimization = 'needs-improvement';
        caching = 'disabled';
      }

      console.log('Starting performance analysis...');
      try {
        const scoreData = await getPageSpeedScores(normalizedUrl);
        performanceScore = scoreData.performanceScore;
        mobileScore = scoreData.mobileScore;
        usingRealData = scoreData.usingRealData;
        console.log(`✅ Performance analysis: Desktop: ${performanceScore}, Mobile: ${mobileScore}, Real data: ${usingRealData}`);
      } catch (error) {
        console.error('❌ Performance analysis failed, using estimated scores:', error instanceof Error ? error.message : 'Unknown error');
        try {
          const estimatedScores = calculateEstimatedScores({
            hasSSL,
            hasCDN,
            caching,
            imageOptimization,
            plugins,
            isWordPress
          });
          performanceScore = estimatedScores.performanceScore;
          mobileScore = estimatedScores.mobileScore;
          usingRealData = false;
          console.log(`✅ Estimated scores: Desktop: ${performanceScore}, Mobile: ${mobileScore}`);
        } catch (estimateError) {
          console.error('❌ Even estimated scoring failed:', estimateError instanceof Error ? estimateError.message : 'Unknown error');
          performanceScore = 45;
          mobileScore = 35;
          usingRealData = false;
        }
      }

      console.log('Generating recommendations...');
      try {
        recommendations = generateRecommendations({
          performanceScore,
          hasCDN,
          caching,
          hasSSL,
          isWordPress,
          plugins,
          imageOptimization
        });
        console.log(`✅ Generated ${recommendations.length} recommendations`);
      } catch (error) {
        console.error('❌ Recommendation generation failed:', error instanceof Error ? error.message : 'Unknown error');
        recommendations = [
          "Optimize images and enable compression",
          "Implement caching to improve load times",
          "Use a Content Delivery Network (CDN)",
          "Ensure SSL is properly configured"
        ];
      }

    } catch (analysisError) {
      console.error('❌ Critical analysis error:', analysisError instanceof Error ? analysisError.message : 'Unknown error');
    }

    const result: AnalysisResult = {
      url: normalizedUrl,
      performanceScore: Math.min(Math.max(performanceScore, 20), 95),
      mobileScore: Math.min(Math.max(mobileScore, 15), 90),
      isWordPress,
      wpVersion,
      theme,
      plugins: plugins > 0 ? plugins : undefined,
      hasSSL,
      hasCDN,
      imageOptimization,
      caching,
      recommendations,
      technologies,
      dataSource: usingRealData ? 'real' : 'estimated',
      confidence: usingRealData ? 'high' : (builtwithTechnologies.length > 0 ? 'medium' : 'low'),
      analysisTimestamp: new Date().toISOString()
    };

    setCachedResult(cacheKey, result);

    console.log(`Analysis completed successfully for ${normalizedUrl}`);

    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Rate-Limit-Remaining': String(rateLimitCheck.remaining || 0)
      },
    });

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    const sanitizedError = sanitizeError(error);
    
    return new Response(
      JSON.stringify({ 
        error: sanitizedError,
        details: 'An unexpected error occurred during analysis. Please try again.'
      }), 
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
      }
    );
  }
});