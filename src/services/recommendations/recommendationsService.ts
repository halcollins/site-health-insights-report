import { PageSpeedResult, WordPressDetectionResult } from '../types/analysisTypes';

export class RecommendationsService {
  generateRecommendations(pageSpeedData: PageSpeedResult | null, wpData: WordPressDetectionResult): string[] {
    const recommendations: string[] = [];
    
    // Only check PageSpeed score if data is available
    if (pageSpeedData) {
      const performanceScore = pageSpeedData.lighthouseResult.categories.performance.score * 100;
      if (performanceScore < 80) {
        recommendations.push("Improve page loading speed by optimizing images and reducing server response time");
      }
    } else {
      // If no PageSpeed data, provide general performance recommendation
      recommendations.push("Improve page loading speed by optimizing images and reducing server response time");
    }

    if (wpData.imageOptimization !== 'good') {
      recommendations.push("Optimize images by compressing and using modern formats like WebP");
    }

    if (wpData.caching === 'disabled') {
      recommendations.push("Enable caching to improve page load times and reduce server load");
    }

    if (!wpData.hasSSL) {
      recommendations.push("Install an SSL certificate to secure your website and improve SEO ranking");
    }

    if (!wpData.hasCDN) {
      recommendations.push("Implement a Content Delivery Network (CDN) to improve global loading speeds");
    }

    if (wpData.isWordPress) {
      recommendations.push("Keep WordPress core, themes, and plugins updated for security and performance");
      
      if (wpData.plugins && wpData.plugins > 20) {
        recommendations.push("Review and deactivate unnecessary plugins to improve performance");
      }
    }

    // Always include some general recommendations
    if (recommendations.length < 3) {
      recommendations.push("Minify CSS, JavaScript, and HTML files to reduce file sizes");
      recommendations.push("Optimize database and remove unnecessary data");
      recommendations.push("Use a performance-optimized hosting provider");
    }

    return recommendations.slice(0, 6); // Limit to 6 recommendations
  }

  estimatePerformanceScore(wpData: WordPressDetectionResult): number {
    let score = 45; // Much more realistic base score
    
    // Smaller, more realistic adjustments
    if (wpData.hasSSL) score += 3;
    if (wpData.hasCDN) score += 6;
    if (wpData.caching === 'enabled') score += 8;
    else if (wpData.caching === 'partial') score += 4;
    if (wpData.imageOptimization === 'good') score += 6;
    else if (wpData.imageOptimization === 'needs-improvement') score += 2;
    
    // Stronger penalties to reflect real performance impact
    if (wpData.plugins && wpData.plugins > 20) score -= 20;
    else if (wpData.plugins && wpData.plugins > 10) score -= 12;
    
    // WordPress penalty
    if (wpData.isWordPress) score -= 12;
    
    // Additional realistic penalties
    if (!wpData.hasCDN && !wpData.hasSSL) score -= 8;
    
    return Math.min(Math.max(score, 20), 75); // Much more realistic range
  }
}

export const recommendationsService = new RecommendationsService();