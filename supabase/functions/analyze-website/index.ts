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

    // Analysis variables with fallbacks
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
      // Technology detection with error handling
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

      // Merge technologies with fallback
      try {
        technologies = mergeTechnologies(builtwithTechnologies, customTechnologies);
        console.log(`✅ Technology merge complete: ${technologies.length} total`);
      } catch (error) {
        console.error('❌ Technology merge failed:', error instanceof Error ? error.message : 'Unknown error');
        technologies = [...builtwithTechnologies, ...customTechnologies].slice(0, 10);
      }

      // WordPress analysis with error handling
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

      // Technical analysis with error handling
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

      // Performance analysis with error handling
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

      // Generate recommendations with error handling
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
      // Use fallback values already set above
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