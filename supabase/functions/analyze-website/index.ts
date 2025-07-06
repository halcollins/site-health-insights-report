import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security configuration
const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 10,
  MAX_URL_LENGTH: 2048,
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  BLOCKED_DOMAINS: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'], // Block local/internal IPs
  BLOCKED_TLDS: ['.local', '.internal'],
};

interface Technology {
  name: string;
  confidence: number;
  version?: string;
  category: string;
}

interface AnalysisResult {
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
  technologies?: Technology[];
}

// Custom technology detection functions
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

// Builtwith API integration
async function getBuiltWithTechnologies(domain: string): Promise<Technology[]> {
  try {
    // Get API key from Supabase secrets
    const BUILTWITH_API_KEY = Deno.env.get('BUILTWITH_API_KEY');
    
    if (!BUILTWITH_API_KEY) {
      console.log('Builtwith API key not found in secrets, skipping Builtwith detection');
      return [];
    }

    // Add cache busting timestamp and random delay
    const timestamp = Date.now();
    const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms delay
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    const apiUrl = `https://api.builtwith.com/free1/api.json?KEY=${BUILTWITH_API_KEY}&LOOKUP=${encodeURIComponent(domain)}&t=${timestamp}`;
    
    console.log(`Calling Builtwith API for domain: ${domain} with timestamp: ${timestamp}`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`Builtwith API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const technologies: Technology[] = [];

    // Parse Builtwith results
    if (data.Results && data.Results[0] && data.Results[0].Result) {
      const result = data.Results[0].Result;
      
      // Process each technology category
      Object.keys(result).forEach(category => {
        const categoryData = result[category];
        if (Array.isArray(categoryData)) {
          categoryData.forEach((tech: any) => {
            technologies.push({
              name: tech.Name || tech.Tag || 'Unknown',
              confidence: 90,
              version: tech.Version || undefined,
              category: category.replace(/([A-Z])/g, ' $1').trim()
            });
          });
        }
      });
    }

    console.log(`Found ${technologies.length} technologies via Builtwith`);
    return technologies;
  } catch (error) {
    console.error('Builtwith API call failed:', error);
    return [];
  }
}

// Custom technology detection (complementary to Builtwith)
function detectTechnologiesCustom(html: string, headers: Record<string, string>): Technology[] {
  const technologies: Technology[] = [];
  const htmlLower = html.toLowerCase();

  // WordPress
  if (detectWordPress(html, headers)) {
    const version = extractWordPressVersion(html);
    technologies.push({
      name: 'WordPress',
      confidence: 95,
      version,
      category: 'CMS'
    });
  }

  // JavaScript frameworks/libraries
  if (htmlLower.includes('react')) {
    technologies.push({ name: 'React', confidence: 80, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('vue')) {
    technologies.push({ name: 'Vue.js', confidence: 80, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('angular')) {
    technologies.push({ name: 'Angular', confidence: 80, category: 'JavaScript frameworks' });
  }
  if (htmlLower.includes('jquery')) {
    technologies.push({ name: 'jQuery', confidence: 90, category: 'JavaScript libraries' });
  }

  // CSS frameworks
  if (htmlLower.includes('bootstrap')) {
    technologies.push({ name: 'Bootstrap', confidence: 85, category: 'CSS frameworks' });
  }
  if (htmlLower.includes('tailwind')) {
    technologies.push({ name: 'Tailwind CSS', confidence: 85, category: 'CSS frameworks' });
  }

  // Analytics
  if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag')) {
    technologies.push({ name: 'Google Analytics', confidence: 95, category: 'Analytics' });
  }

  // CDN detection
  if (detectCDN(html, headers)) {
    technologies.push({ name: 'CDN', confidence: 90, category: 'CDN' });
  }

  return technologies;
}

// Merge technologies from different sources, removing duplicates
function mergeTechnologies(builtwithTech: Technology[], customTech: Technology[]): Technology[] {
  const merged = [...builtwithTech];
  const existingNames = new Set(builtwithTech.map(tech => tech.name.toLowerCase()));

  // Add custom technologies that aren't already detected by Builtwith
  customTech.forEach(tech => {
    if (!existingNames.has(tech.name.toLowerCase())) {
      merged.push(tech);
    }
  });

  return merged;
}

// Security functions
function validateAndSanitizeUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  try {
    // Check URL length
    if (url.length > SECURITY_CONFIG.MAX_URL_LENGTH) {
      return { isValid: false, error: 'URL too long' };
    }

    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);

    // Check protocol
    if (!SECURITY_CONFIG.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { isValid: false, error: 'Invalid protocol' };
    }

    // Check for blocked domains/IPs
    const hostname = urlObj.hostname.toLowerCase();
    if (SECURITY_CONFIG.BLOCKED_DOMAINS.some(blocked => hostname.includes(blocked))) {
      return { isValid: false, error: 'Access to internal/local resources not allowed' };
    }

    // Check for blocked TLDs
    if (SECURITY_CONFIG.BLOCKED_TLDS.some(tld => hostname.endsWith(tld))) {
      return { isValid: false, error: 'Access to internal domains not allowed' };
    }

    // Check for private IP ranges
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      // Block private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 127) // localhost
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
  const key = clientIP;
  const limit = rateLimitStore.get(key);

  // Reset if window expired
  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return { allowed: true, remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - 1 };
  }

  // Check if under limit
  if (limit.count < SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    limit.count++;
    return { allowed: true, remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - limit.count };
  }

  return { allowed: false };
}

function sanitizeError(error: unknown): string {
  // Return generic error messages to prevent information disclosure
  if (error instanceof Error) {
    // Only expose specific safe error messages
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

    // Performance scoring
    let performanceScore = 75; // Base score
    
    if (hasSSL) performanceScore += 5;
    if (hasCDN) performanceScore += 10;
    if (caching === 'enabled') performanceScore += 10;
    else if (caching === 'partial') performanceScore += 5;
    if (imageOptimization === 'good') performanceScore += 10;
    else if (imageOptimization === 'needs-improvement') performanceScore += 5;
    
    // Penalize for too many plugins
    if (plugins > 20) performanceScore -= 10;
    else if (plugins > 10) performanceScore -= 5;

    const mobileScore = Math.max(30, performanceScore - Math.floor(Math.random() * 15 + 5));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (performanceScore < 80) {
      recommendations.push("Improve page loading speed by optimizing images and reducing server response time");
    }
    
    if (!hasCDN) {
      recommendations.push("Implement a Content Delivery Network (CDN) to improve global loading speeds");
    }
    
    if (caching === 'disabled') {
      recommendations.push("Enable caching to improve page load times and reduce server load");
    }
    
    if (!hasSSL) {
      recommendations.push("Install an SSL certificate to secure your website and improve SEO ranking");
    }
    
    if (isWordPress) {
      recommendations.push("Keep WordPress core, themes, and plugins updated for security and performance");
      
      if (plugins > 20) {
        recommendations.push("Review and deactivate unnecessary plugins to improve performance");
      }
    }

    if (imageOptimization !== 'good') {
      recommendations.push("Optimize images by compressing and using modern formats like WebP");
    }

    // Add general recommendations if needed
    if (recommendations.length < 3) {
      recommendations.push("Minify CSS, JavaScript, and HTML files to reduce file sizes");
      recommendations.push("Optimize database and remove unnecessary data");
      recommendations.push("Use a performance-optimized hosting provider");
    }

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
      recommendations: recommendations.slice(0, 6),
      technologies
    };

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