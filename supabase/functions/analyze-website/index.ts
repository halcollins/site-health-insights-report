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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST requests
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
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    console.log(`Request from IP: ${clientIP.substring(0, 10)}...`);

    // Check rate limiting
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

    // Parse request body
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

    // Validate and sanitize URL
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

    // Check cache first
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

    // Extract domain for Builtwith API
    const domain = new URL(normalizedUrl).hostname;
    console.log(`Extracted domain: ${domain}`);

    // Fetch website content for analysis
    let html = '';
    let headers: Record<string, string> = {};
    
    try {
      console.log(`Fetching website content from: ${normalizedUrl}`);
      
      // Try direct fetch first (for sites with proper CORS)
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
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        if (response.ok) {
          html = await response.text();
          // Convert headers to record
          response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
          });
          console.log(`Direct fetch successful for: ${normalizedUrl}`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (directError) {
        console.log(`Direct fetch failed: ${directError}, trying CORS proxy...`);
        
        // Fallback to CORS proxy
        const corsProxy = 'https://api.allorigins.win/get?url=';
        const proxyResponse = await fetch(`${corsProxy}${encodeURIComponent(normalizedUrl)}`, {
          signal: AbortSignal.timeout(20000) // 20 second timeout for proxy
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

    // Detect technologies using both Builtwith API and custom detection
    console.log('Starting technology detection...');
    const builtwithTechnologies = await getBuiltWithTechnologies(domain);
    const customTechnologies = detectTechnologiesCustom(html, headers);
    
    // Merge both technology detection results
    const technologies = mergeTechnologies(builtwithTechnologies, customTechnologies);
    
    console.log(`Technology detection complete: ${builtwithTechnologies.length} via Builtwith, ${customTechnologies.length} via custom, ${technologies.length} total`);

    // WordPress analysis
    console.log('Starting WordPress analysis...');
    const isWordPress = detectWordPress(html, headers);
    const wpVersion = isWordPress ? extractWordPressVersion(html) : undefined;
    const theme = isWordPress ? extractThemeName(html) : undefined;
    const plugins = isWordPress ? countPlugins(html) : 0;

    console.log(`WordPress analysis: ${isWordPress ? 'detected' : 'not detected'}, version: ${wpVersion || 'unknown'}, theme: ${theme || 'unknown'}, plugins: ${plugins}`);

    // Technical analysis
    console.log('Starting technical analysis...');
    const hasSSL = normalizedUrl.startsWith('https://');
    const hasCDN = detectCDN(html, headers);
    const imageOptimization = analyzeImageOptimization(html);
    const caching = analyzeCaching(headers);

    console.log(`Technical analysis: SSL: ${hasSSL}, CDN: ${hasCDN}, Images: ${imageOptimization}, Caching: ${caching}`);

    // Get performance scores (real or estimated)
    console.log('Starting performance analysis...');
    const scoreData = await getPageSpeedScores(normalizedUrl);
    let { performanceScore, mobileScore, usingRealData } = scoreData;
    
    // Fallback to estimated scoring if PageSpeed API failed
    if (!usingRealData) {
      console.log('Using estimated performance scores...');
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

    console.log(`Performance scores: Desktop: ${performanceScore}, Mobile: ${mobileScore}, Real data: ${usingRealData}`);

    // Generate recommendations
    console.log('Generating recommendations...');
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

    // Cache the result
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