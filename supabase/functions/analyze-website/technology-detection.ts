// Technology detection utilities

export interface Technology {
  name: string;
  confidence: number;
  version?: string;
  category: string;
}

// WordPress detection functions
export function detectWordPress(html: string, headers: Record<string, string>) {
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

export function extractWordPressVersion(html: string): string | undefined {
  const versionMatch = html.match(/wp-includes\/js\/wp-emoji-release\.min\.js\?ver=([0-9.]+)/);
  if (versionMatch) return versionMatch[1];

  const metaMatch = html.match(/<meta name="generator" content="WordPress ([0-9.]+)"/);
  if (metaMatch) return metaMatch[1];

  return undefined;
}

export function extractThemeName(html: string): string | undefined {
  const themeMatch = html.match(/\/wp-content\/themes\/([^\/\?'"]+)/);
  if (themeMatch) {
    return themeMatch[1].charAt(0).toUpperCase() + themeMatch[1].slice(1);
  }
  return undefined;
}

export function countPlugins(html: string): number {
  const pluginMatches = html.match(/\/wp-content\/plugins\/([^\/\?'"]+)/g);
  if (pluginMatches) {
    const uniquePlugins = new Set(pluginMatches.map(match => match.split('/')[3]));
    return uniquePlugins.size;
  }
  return 0;
}

export function detectCDN(html: string, headers: Record<string, string>): boolean {
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

export function analyzeCaching(headers: Record<string, string>): 'enabled' | 'partial' | 'disabled' {
  const cacheHeaders = ['cache-control', 'expires', 'etag', 'last-modified'];
  const foundHeaders = cacheHeaders.filter(header => headers[header]);

  if (foundHeaders.length >= 3) return 'enabled';
  if (foundHeaders.length >= 1) return 'partial';
  return 'disabled';
}

export function analyzeImageOptimization(html: string): 'good' | 'needs-improvement' | 'poor' {
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
export async function getBuiltWithTechnologies(domain: string): Promise<Technology[]> {
  try {
    // Get API key from Supabase secrets
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
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    if (!response.ok) {
      console.error(`BuiltWith API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const technologies: Technology[] = [];

    // Parse BuiltWith results
    if (data.Results && data.Results[0] && data.Results[0].Result) {
      const result = data.Results[0].Result;
      
      // Process each technology category
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

// Custom technology detection (complementary to Builtwith)
export function detectTechnologiesCustom(html: string, headers: Record<string, string>): Technology[] {
  const technologies: Technology[] = [];
  const htmlLower = html.toLowerCase();

  // WordPress
  if (detectWordPress(html, headers)) {
    const version = extractWordPressVersion(html);
    technologies.push({
      name: 'WordPress',
      confidence: 90,
      version,
      category: 'CMS'
    });
  }

  // JavaScript frameworks/libraries
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

  // CSS frameworks
  if (htmlLower.includes('bootstrap') || htmlLower.includes('bootstrap.min.css')) {
    technologies.push({ name: 'Bootstrap', confidence: 80, category: 'CSS frameworks' });
  }
  if (htmlLower.includes('tailwind') || htmlLower.includes('tailwindcss')) {
    technologies.push({ name: 'Tailwind CSS', confidence: 80, category: 'CSS frameworks' });
  }

  // Analytics
  if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag')) {
    technologies.push({ name: 'Google Analytics', confidence: 90, category: 'Analytics' });
  }
  
  if (htmlLower.includes('gtm') || htmlLower.includes('googletagmanager')) {
    technologies.push({ name: 'Google Tag Manager', confidence: 85, category: 'Tag managers' });
  }

  // CDN detection
  if (detectCDN(html, headers)) {
    technologies.push({ name: 'Content Delivery Network', confidence: 80, category: 'CDN' });
  }

  return technologies;
}

// Merge technologies from different sources, removing duplicates  
export function mergeTechnologies(builtwithTech: Technology[], customTech: Technology[]): Technology[] {
  const merged = [...builtwithTech];
  const existingNames = new Set(builtwithTech.map(tech => tech.name.toLowerCase()));

  // Add custom technologies that aren't already detected by BuiltWith
  customTech.forEach(tech => {
    if (!existingNames.has(tech.name.toLowerCase())) {
      merged.push(tech);
    }
  });

  // Sort by confidence and limit to reasonable number
  return merged
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Limit to top 20 technologies
}