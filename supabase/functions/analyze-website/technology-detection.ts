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
export function detectTechnologiesCustom(html: string, headers: Record<string, string>): Technology[] {
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
export function mergeTechnologies(builtwithTech: Technology[], customTech: Technology[]): Technology[] {
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