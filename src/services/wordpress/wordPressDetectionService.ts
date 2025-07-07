import { WordPressDetectionResult } from '../types/analysisTypes';

export class WordPressDetectionService {
  private readonly CORS_PROXY = 'https://api.allorigins.win/raw?url=';

  async detectWordPress(url: string): Promise<WordPressDetectionResult> {
    try {
      const proxyUrl = `${this.CORS_PROXY}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const html = await response.text();
      const headers = Object.fromEntries(response.headers.entries());

      // WordPress detection
      const isWordPress = this.isWordPressDetected(html, headers);
      const wpVersion = this.extractWordPressVersion(html);
      const theme = this.extractThemeName(html);
      const plugins = this.countPlugins(html);

      // Technical analysis
      const hasSSL = url.startsWith('https://');
      const hasCDN = this.detectCDN(html, headers);
      const imageOptimization = this.analyzeImageOptimization(html);
      const caching = this.analyzeCaching(headers);

      return {
        isWordPress,
        wpVersion,
        theme,
        plugins,
        hasSSL,
        hasCDN,
        imageOptimization,
        caching
      };
    } catch (error) {
      // Fallback to basic URL analysis if CORS proxy fails
      return {
        isWordPress: false,
        hasSSL: url.startsWith('https://'),
        hasCDN: false,
        imageOptimization: 'needs-improvement' as const,
        caching: 'disabled' as const
      };
    }
  }

  private isWordPressDetected(html: string, headers: Record<string, string>): boolean {
    const wpIndicators = [
      '/wp-content/',
      '/wp-includes/',
      'wp-json',
      'wordpress',
      'wp_enqueue_script',
      'wp-admin'
    ];

    const htmlLower = html.toLowerCase();
    const hasWpContent = wpIndicators.some(indicator => htmlLower.includes(indicator));
    
    // Check headers for WordPress indicators
    const wpHeaders = Object.values(headers).some(value => 
      value.toLowerCase().includes('wordpress')
    );

    return hasWpContent || wpHeaders;
  }

  private extractWordPressVersion(html: string): string | undefined {
    const versionMatch = html.match(/wp-includes\/js\/wp-emoji-release\.min\.js\?ver=([0-9.]+)/);
    if (versionMatch) {
      return versionMatch[1];
    }

    const metaMatch = html.match(/<meta name="generator" content="WordPress ([0-9.]+)"/);
    if (metaMatch) {
      return metaMatch[1];
    }

    return undefined;
  }

  private extractThemeName(html: string): string | undefined {
    const themeMatch = html.match(/\/wp-content\/themes\/([^\/\?'"]+)/);
    if (themeMatch) {
      return themeMatch[1].charAt(0).toUpperCase() + themeMatch[1].slice(1);
    }
    return undefined;
  }

  private countPlugins(html: string): number {
    const pluginMatches = html.match(/\/wp-content\/plugins\/([^\/\?'"]+)/g);
    if (pluginMatches) {
      const uniquePlugins = new Set(pluginMatches.map(match => match.split('/')[3]));
      return uniquePlugins.size;
    }
    return 0;
  }

  private detectCDN(html: string, headers: Record<string, string>): boolean {
    const cdnIndicators = [
      'cloudflare',
      'cloudfront',
      'fastly',
      'maxcdn',
      'keycdn',
      'jsdelivr',
      'unpkg'
    ];

    const htmlLower = html.toLowerCase();
    const headerValues = Object.values(headers).join(' ').toLowerCase();

    return cdnIndicators.some(cdn => 
      htmlLower.includes(cdn) || headerValues.includes(cdn)
    );
  }

  private analyzeImageOptimization(html: string): 'good' | 'needs-improvement' | 'poor' {
    const images = html.match(/<img[^>]+>/g) || [];
    if (images.length === 0) return 'good';

    const webpImages = images.filter(img => img.includes('.webp')).length;
    const totalImages = images.length;
    const webpRatio = webpImages / totalImages;

    if (webpRatio > 0.7) return 'good';
    if (webpRatio > 0.3) return 'needs-improvement';
    return 'poor';
  }

  private analyzeCaching(headers: Record<string, string>): 'enabled' | 'partial' | 'disabled' {
    const cacheHeaders = ['cache-control', 'expires', 'etag', 'last-modified'];
    const foundHeaders = cacheHeaders.filter(header => headers[header]);

    if (foundHeaders.length >= 3) return 'enabled';
    if (foundHeaders.length >= 1) return 'partial';
    return 'disabled';
  }
}

export const wordPressDetectionService = new WordPressDetectionService();