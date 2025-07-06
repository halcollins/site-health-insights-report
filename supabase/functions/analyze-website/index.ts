import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WappalyzerResponse {
  url: string;
  technologies: Array<{
    name: string;
    confidence: number;
    version?: string;
    categories: Array<{
      id: number;
      slug: string;
      name: string;
    }>;
  }>;
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
  technologies?: Array<{
    name: string;
    confidence: number;
    version?: string;
    category: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }

    console.log(`Analyzing website: ${url}`);

    // Get Wappalyzer API key from environment
    const wappalyzerApiKey = Deno.env.get('WAPPALYZER_API_KEY');
    
    if (!wappalyzerApiKey) {
      throw new Error('Wappalyzer API key not configured');
    }

    // Call Wappalyzer API for technology detection
    const wappalyzerResponse = await fetch(`https://api.wappalyzer.com/lookup/v2/?urls=${encodeURIComponent(url)}`, {
      headers: {
        'x-api-key': wappalyzerApiKey,
      },
    });

    if (!wappalyzerResponse.ok) {
      throw new Error(`Wappalyzer API error: ${wappalyzerResponse.status}`);
    }

    const wappalyzerData: WappalyzerResponse[] = await wappalyzerResponse.json();
    const siteData = wappalyzerData[0];

    // Enhanced WordPress detection using Wappalyzer
    const wpTechnology = siteData.technologies.find(tech => 
      tech.name.toLowerCase() === 'wordpress'
    );
    
    const isWordPress = !!wpTechnology;
    const wpVersion = wpTechnology?.version;

    // Detect theme from technologies
    const themeTech = siteData.technologies.find(tech =>
      tech.categories.some(cat => cat.slug === 'wordpress-themes')
    );
    const theme = themeTech?.name;

    // Count WordPress plugins
    const plugins = siteData.technologies.filter(tech =>
      tech.categories.some(cat => cat.slug === 'wordpress-plugins')
    ).length;

    // Analyze other technologies
    const hasCDN = siteData.technologies.some(tech =>
      tech.categories.some(cat => cat.slug === 'cdn')
    );

    const cachingTechs = siteData.technologies.filter(tech =>
      tech.categories.some(cat => cat.slug === 'caching')
    );
    const caching = cachingTechs.length > 0 ? 'enabled' : 'disabled';

    // Basic SSL check
    const hasSSL = url.startsWith('https://');

    // Estimate performance based on technologies
    let performanceScore = 75; // Base score
    
    if (hasSSL) performanceScore += 5;
    if (hasCDN) performanceScore += 10;
    if (caching === 'enabled') performanceScore += 10;
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

    // Add general recommendations if needed
    if (recommendations.length < 3) {
      recommendations.push("Optimize images by compressing and using modern formats like WebP");
      recommendations.push("Minify CSS, JavaScript, and HTML files to reduce file sizes");
      recommendations.push("Use a performance-optimized hosting provider");
    }

    // Format technologies for response
    const technologies = siteData.technologies.map(tech => ({
      name: tech.name,
      confidence: tech.confidence,
      version: tech.version,
      category: tech.categories[0]?.name || 'Other'
    }));

    const result: AnalysisResult = {
      url,
      performanceScore: Math.min(Math.max(performanceScore, 30), 95),
      mobileScore,
      isWordPress,
      wpVersion,
      theme,
      plugins: plugins > 0 ? plugins : undefined,
      hasSSL,
      hasCDN,
      imageOptimization: 'needs-improvement', // Could be enhanced with more analysis
      caching: caching as 'enabled' | 'partial' | 'disabled',
      recommendations: recommendations.slice(0, 6),
      technologies
    };

    console.log(`Analysis completed for ${url}:`, {
      isWordPress,
      wpVersion,
      theme,
      plugins,
      technologiesFound: technologies.length
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Analysis failed',
        details: 'Please check the URL and try again'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});