// Security and validation utilities

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security configuration
export const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 10, // Reduced from 15 for better security
  MAX_URL_LENGTH: 2048,
  MAX_NAME_LENGTH: 100,
  MAX_COMPANY_LENGTH: 200,
  MAX_EMAIL_LENGTH: 254, // RFC 5321 limit
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  BLOCKED_DOMAINS: ['localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.169.254'], // Block local/internal IPs
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
    if (SECURITY_CONFIG.BLOCKED_DOMAINS.some(blocked => 
      hostname === blocked || hostname.includes(blocked)
    )) {
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
      
      // Validate IP parts are in valid range
      if (parts.some(part => part < 0 || part > 255)) {
        return { isValid: false, error: 'Invalid IP address format' };
      }
      
      // Block private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 127) || // localhost
        (parts[0] === 169 && parts[1] === 254) // link-local
      ) {
        return { isValid: false, error: 'Access to private IP ranges not allowed' };
      }
    }

    return { isValid: true, normalizedUrl };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

export function checkRateLimit(clientIP: string): { allowed: boolean; remaining?: number; resetTime?: number } {
  const now = Date.now();
  const key = clientIP.substring(0, 15); // Truncate IP for privacy
  const limit = rateLimitStore.get(key);

  // Reset if window expired
  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    console.log(`✅ Rate limit reset for IP ${key}: 1/10 requests`);
    return { 
      allowed: true, 
      remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - 1,
      resetTime: now + 60000
    };
  }

  // Check if under limit
  if (limit.count < SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    limit.count++;
    console.log(`✅ Rate limit check for IP ${key}: ${limit.count}/${SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE} requests`);
    return { 
      allowed: true, 
      remaining: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE - limit.count,
      resetTime: limit.resetTime
    };
  }

  console.log(`🚫 Rate limit exceeded for IP ${key}: ${limit.count}/${SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE} requests`);
  return { 
    allowed: false, 
    remaining: 0,
    resetTime: limit.resetTime
  };
}

// Lead data validation interface
export interface LeadData {
  name: string;
  email: string;
  company: string;
  websiteUrl: string;
}

// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// HTML/XSS sanitization
function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove on* event handlers
    .trim();
}

export function validateLeadData(leadData: any): { isValid: boolean; sanitizedData?: LeadData; errors?: string[] } {
  const errors: string[] = [];
  
  if (!leadData || typeof leadData !== 'object') {
    return { isValid: false, errors: ['Invalid lead data format'] };
  }

  // Validate and sanitize name
  if (!leadData.name || typeof leadData.name !== 'string') {
    errors.push('Name is required');
  } else if (leadData.name.length > SECURITY_CONFIG.MAX_NAME_LENGTH) {
    errors.push(`Name must be less than ${SECURITY_CONFIG.MAX_NAME_LENGTH} characters`);
  }

  // Validate and sanitize email
  if (!leadData.email || typeof leadData.email !== 'string') {
    errors.push('Email is required');
  } else if (leadData.email.length > SECURITY_CONFIG.MAX_EMAIL_LENGTH) {
    errors.push(`Email must be less than ${SECURITY_CONFIG.MAX_EMAIL_LENGTH} characters`);
  } else if (!EMAIL_REGEX.test(leadData.email)) {
    errors.push('Invalid email format');
  }

  // Validate and sanitize company
  if (!leadData.company || typeof leadData.company !== 'string') {
    errors.push('Company is required');
  } else if (leadData.company.length > SECURITY_CONFIG.MAX_COMPANY_LENGTH) {
    errors.push(`Company must be less than ${SECURITY_CONFIG.MAX_COMPANY_LENGTH} characters`);
  }

  // Validate website URL
  if (!leadData.websiteUrl || typeof leadData.websiteUrl !== 'string') {
    errors.push('Website URL is required');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Return sanitized data
  const sanitizedData: LeadData = {
    name: sanitizeString(leadData.name),
    email: leadData.email.toLowerCase().trim(), // Email normalization
    company: sanitizeString(leadData.company),
    websiteUrl: leadData.websiteUrl.trim()
  };

  return { isValid: true, sanitizedData };
}

// Generate unique request ID for tracking
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Monitor suspicious patterns (multiple requests from same data)
const submissionTracker = new Map<string, { count: number; lastSubmission: number }>();

export function checkSuspiciousActivity(email: string): { suspicious: boolean; reason?: string } {
  const now = Date.now();
  const key = email.toLowerCase();
  const track = submissionTracker.get(key);
  
  // Clean up old entries (older than 1 hour)
  if (track && now - track.lastSubmission > 3600000) {
    submissionTracker.delete(key);
  }
  
  const currentTrack = submissionTracker.get(key);
  
  if (!currentTrack) {
    submissionTracker.set(key, { count: 1, lastSubmission: now });
    return { suspicious: false };
  }
  
  // Check for rapid repeated submissions (more than 3 in 10 minutes)
  if (currentTrack.count >= 3 && now - currentTrack.lastSubmission < 600000) {
    console.log(`🚨 Suspicious activity detected for email: ${key.substring(0, 3)}***`);
    return { suspicious: true, reason: 'Multiple rapid submissions detected' };
  }
  
  currentTrack.count++;
  currentTrack.lastSubmission = now;
  
  return { suspicious: false };
}

export function sanitizeError(error: unknown, requestId?: string): string {
  const prefix = requestId ? `[${requestId}] ` : '';
  
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
      'Rate limit exceeded',
      'Name is required',
      'Email is required',
      'Company is required',
      'Website URL is required',
      'Invalid email format',
      'Invalid lead data format'
    ];
    
    if (safeErrors.some(safe => error.message.includes(safe))) {
      return prefix + error.message;
    }
  }
  
  return prefix + 'Analysis failed. Please check your information and try again.';
}