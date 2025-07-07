import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Import modular components
import { validateAndSanitizeUrl, checkRateLimit, sanitizeError } from './validation.ts';
import { getCachedResult, setCachedResult } from './caching.ts';
import { 
  getBuiltWithTechnologies, 
  detectTechnologiesCustom, 
  mergeTechnologies,
  detectWordPress,
  extractWordPressVersion,
  extractThemeName,
  countPlugins,
  detectCDN,
  analyzeCaching,
  analyzeImageOptimization
} from './technology-detection.ts';
import { 
  getPageSpeedScores, 
  calculateEstimatedScores, 
  generateRecommendations 
} from './performance-analysis.ts';
import { AnalysisResult } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
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

    const { url } = await req.json();
    
    if (!url) {
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

    // Validate and sanitize URL
    const urlValidation = validateAndSanitizeUrl(url);
    if (!urlValidation.isValid) {
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
    console.log(`Analyzing website: ${normalizedUrl} from IP: ${clientIP}`);

    // Check cache first
    const cacheKey = normalizedUrl;
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      return new Response(JSON.stringify(cachedResult), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Rate-Limit-Remaining': String(rateLimitCheck.remaining || 0)
        },
      });
    }

    // Extract domain for Builtwith API
    const domain = new URL(normalizedUrl).hostname;

    // Fetch website content for analysis with cache busting
    const corsProxy = 'https://api.allorigins.win/get?url=';
    const timestamp = Date.now();
    const cacheBustUrl = normalizedUrl.includes('?') ? `${normalizedUrl}&_cb=${timestamp}` : `${normalizedUrl}?_cb=${timestamp}`;
    const response = await fetch(`${corsProxy}${encodeURIComponent(cacheBustUrl)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }
    
    const data = await response.json();
    const html = data.contents;
    const headers: Record<string, string> = {};

    // Detect technologies using both Builtwith API and custom detection
    const builtwithTechnologies = await getBuiltWithTechnologies(domain);
    const customTechnologies = detectTechnologiesCustom(html, headers);
    
    // Merge both technology detection results
    const technologies = mergeTechnologies(builtwithTechnologies, customTechnologies);
    
    console.log(`Found ${builtwithTechnologies.length} technologies via Builtwith, ${customTechnologies.length} via custom detection, ${technologies.length} total`);

    // WordPress analysis
    const isWordPress = detectWordPress(html, headers);
    const wpVersion = isWordPress ? extractWordPressVersion(html) : undefined;
    const theme = isWordPress ? extractThemeName(html) : undefined;
    const plugins = isWordPress ? countPlugins(html) : 0;

    // Technical analysis
    const hasSSL = url.startsWith('https://');
    const hasCDN = detectCDN(html, headers);
    const imageOptimization = analyzeImageOptimization(html);
    const caching = analyzeCaching(headers);

    // Get performance scores (real or estimated)
    const scoreData = await getPageSpeedScores(normalizedUrl);
    let { performanceScore, mobileScore, usingRealData } = scoreData;
    
    // Fallback to estimated scoring if PageSpeed API failed
    if (!usingRealData) {
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
    }

    // Generate recommendations
    const recommendations = generateRecommendations({
      performanceScore,
      hasCDN,
      caching,
      hasSSL,
      isWordPress,
      plugins,
      imageOptimization
    });

    const result: AnalysisResult = {
      url: normalizedUrl,
      performanceScore: Math.min(Math.max(performanceScore, 30), 95),
      mobileScore,
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

    // Cache the result
    setCachedResult(cacheKey, result);

    console.log(`Analysis completed for ${normalizedUrl}:`, {
      isWordPress,
      wpVersion,
      theme,
      plugins,
      technologiesFound: technologies.length,
      clientIP: clientIP.substring(0, 10) + '...' // Log partial IP for security
    });

    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Security-Policy': "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none';",
        'X-Rate-Limit-Remaining': String(rateLimitCheck.remaining || 0)
      },
    });

  } catch (error) {
    console.error('Error in analyze-website function:', error instanceof Error ? error.message : 'Unknown error');
    const sanitizedError = sanitizeError(error);
    
    return new Response(
      JSON.stringify({ 
        error: sanitizedError,
        details: 'Please check the URL and try again'
      }), 
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Security-Policy': "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none';"
        },
      }
    );
  }
});