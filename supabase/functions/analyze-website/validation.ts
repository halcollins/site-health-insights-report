// Security and validation utilities

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security configuration
export const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 10,
  MAX_URL_LENGTH: 2048,
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  BLOCKED_DOMAINS: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'], // Block local/internal IPs
  BLOCKED_TLDS: ['.local', '.internal'],
};

export function validateAndSanitizeUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
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

export function checkRateLimit(clientIP: string): { allowed: boolean; remaining?: number } {
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

export function sanitizeError(error: unknown): string {
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