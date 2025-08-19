interface SecurityHeader {
  name: string;
  expected: string | boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

interface SecurityIssue {
  type: 'security_header' | 'ssl_tls' | 'directory_listing' | 'information_disclosure' | 'injection' | 'xss' | 'misconfiguration';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
  cvssScore?: number;
}

interface WebSecurityResult {
  securityScore: number;
  missingSecurityHeaders: string[];
  securityIssues: SecurityIssue[];
  sslAnalysis: {
    hasSSL: boolean;
    tlsVersion?: string;
    certificateValid: boolean;
    weakCiphers: boolean;
    hsts: boolean;
  };
  vulnerabilityTests: {
    directoryTraversal: boolean;
    sqlInjection: boolean;
    xssVulnerable: boolean;
    openRedirect: boolean;
  };
}

export class WebSecurityScanner {
  private readonly SECURITY_HEADERS: SecurityHeader[] = [
    {
      name: 'strict-transport-security',
      expected: true,
      severity: 'high',
      description: 'HTTP Strict Transport Security (HSTS) is missing',
      recommendation: 'Add HSTS header to force HTTPS connections and prevent downgrade attacks'
    },
    {
      name: 'content-security-policy',
      expected: true,
      severity: 'high',
      description: 'Content Security Policy (CSP) is missing',
      recommendation: 'Implement CSP header to prevent XSS and data injection attacks'
    },
    {
      name: 'x-frame-options',
      expected: true,
      severity: 'medium',
      description: 'X-Frame-Options header is missing',
      recommendation: 'Add X-Frame-Options header to prevent clickjacking attacks'
    },
    {
      name: 'x-content-type-options',
      expected: 'nosniff',
      severity: 'medium',
      description: 'X-Content-Type-Options header is missing',
      recommendation: 'Add X-Content-Type-Options: nosniff to prevent MIME type sniffing'
    },
    {
      name: 'referrer-policy',
      expected: true,
      severity: 'low',
      description: 'Referrer-Policy header is missing',
      recommendation: 'Add Referrer-Policy header to control referrer information'
    },
    {
      name: 'permissions-policy',
      expected: true,
      severity: 'low',
      description: 'Permissions-Policy header is missing',
      recommendation: 'Add Permissions-Policy header to control browser features'
    },
    {
      name: 'x-xss-protection',
      expected: '1; mode=block',
      severity: 'low',
      description: 'X-XSS-Protection header is missing or misconfigured',
      recommendation: 'Add X-XSS-Protection: 1; mode=block header'
    }
  ];

  private readonly COMMON_PATHS = [
    '/.env',
    '/.git/',
    '/.svn/',
    '/admin',
    '/administrator',
    '/backup',
    '/config',
    '/database',
    '/db',
    '/debug',
    '/logs',
    '/phpinfo.php',
    '/server-status',
    '/server-info',
    '/.htaccess',
    '/robots.txt',
    '/sitemap.xml'
  ];

  async performSecurityScan(url: string, html: string, headers: Record<string, string>): Promise<WebSecurityResult> {
    const result: WebSecurityResult = {
      securityScore: 100,
      missingSecurityHeaders: [],
      securityIssues: [],
      sslAnalysis: {
        hasSSL: url.startsWith('https://'),
        certificateValid: true,
        weakCiphers: false,
        hsts: false
      },
      vulnerabilityTests: {
        directoryTraversal: false,
        sqlInjection: false,
        xssVulnerable: false,
        openRedirect: false
      }
    };

    // Analyze security headers
    this.analyzeSecurityHeaders(headers, result);

    // Analyze SSL/TLS configuration
    this.analyzeSSLConfiguration(url, headers, result);

    // Check for common vulnerabilities
    await this.checkCommonVulnerabilities(url, html, result);

    // Test for directory traversal
    await this.testDirectoryTraversal(url, result);

    // Check for information disclosure
    this.checkInformationDisclosure(html, headers, result);

    // Calculate final security score
    this.calculateSecurityScore(result);

    return result;
  }

  private analyzeSecurityHeaders(headers: Record<string, string>, result: WebSecurityResult): void {
    const headerKeys = Object.keys(headers).map(h => h.toLowerCase());

    this.SECURITY_HEADERS.forEach(securityHeader => {
      const headerExists = headerKeys.includes(securityHeader.name.toLowerCase());
      
      if (!headerExists) {
        result.missingSecurityHeaders.push(securityHeader.name);
        result.securityIssues.push({
          type: 'security_header',
          severity: securityHeader.severity,
          title: `Missing Security Header: ${securityHeader.name}`,
          description: securityHeader.description,
          recommendation: securityHeader.recommendation
        });
      } else {
        // Check header value if specific value expected
        if (typeof securityHeader.expected === 'string') {
          const headerValue = headers[securityHeader.name.toLowerCase()];
          if (headerValue !== securityHeader.expected) {
            result.securityIssues.push({
              type: 'security_header',
              severity: 'medium',
              title: `Misconfigured Security Header: ${securityHeader.name}`,
              description: `${securityHeader.name} header exists but may be misconfigured`,
              evidence: `Current value: ${headerValue}`,
              recommendation: `Set ${securityHeader.name} to: ${securityHeader.expected}`
            });
          }
        }
      }
    });

    // Check for HSTS
    if (headerKeys.includes('strict-transport-security')) {
      result.sslAnalysis.hsts = true;
    }
  }

  private analyzeSSLConfiguration(url: string, headers: Record<string, string>, result: WebSecurityResult): void {
    if (!url.startsWith('https://')) {
      result.securityIssues.push({
        type: 'ssl_tls',
        severity: 'high',
        title: 'No SSL/TLS Encryption',
        description: 'Website is not using HTTPS encryption',
        recommendation: 'Implement SSL/TLS certificate and redirect all HTTP traffic to HTTPS'
      });
      result.sslAnalysis.hasSSL = false;
      return;
    }

    // Check for mixed content warnings in headers
    const contentSecurityPolicy = headers['content-security-policy'];
    if (contentSecurityPolicy && contentSecurityPolicy.includes('upgrade-insecure-requests')) {
      result.securityIssues.push({
        type: 'ssl_tls',
        severity: 'medium',
        title: 'Mixed Content Detected',
        description: 'Website may be loading insecure content over HTTP',
        recommendation: 'Ensure all resources are loaded over HTTPS'
      });
    }

    // Check for weak TLS configuration indicators
    const server = headers['server'];
    if (server && (server.includes('TLS/1.0') || server.includes('TLS/1.1'))) {
      result.sslAnalysis.weakCiphers = true;
      result.securityIssues.push({
        type: 'ssl_tls',
        severity: 'high',
        title: 'Weak TLS Configuration',
        description: 'Server may be using outdated TLS versions',
        recommendation: 'Upgrade to TLS 1.2 or higher and disable weak cipher suites'
      });
    }
  }

  private async checkCommonVulnerabilities(url: string, html: string, result: WebSecurityResult): Promise<void> {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    // Check for exposed sensitive files/directories
    for (const path of this.COMMON_PATHS) {
      try {
        const testUrl = `${baseUrl}${path}`;
        const response = await fetch(testUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const severity = path.includes('.env') || path.includes('config') ? 'critical' : 
                          path.includes('admin') || path.includes('.git') ? 'high' : 'medium';
          
          result.securityIssues.push({
            type: 'information_disclosure',
            severity,
            title: `Exposed Path: ${path}`,
            description: `Sensitive path ${path} is accessible and may contain confidential information`,
            evidence: `Accessible at: ${testUrl}`,
            recommendation: severity === 'critical' 
              ? 'Immediately restrict access to configuration files and environment variables'
              : 'Restrict access to sensitive directories and files'
          });
        }
      } catch (error) {
        // Path not accessible, which is good
      }
    }

    // Check for directory listing
    if (html.includes('Index of /') || html.includes('Directory Listing') || html.includes('[DIR]')) {
      result.securityIssues.push({
        type: 'directory_listing',
        severity: 'medium',
        title: 'Directory Listing Enabled',
        description: 'Web server allows directory browsing which can expose sensitive files',
        recommendation: 'Disable directory listing in web server configuration'
      });
    }
  }

  private async testDirectoryTraversal(url: string, result: WebSecurityResult): Promise<void> {
    const urlObj = new URL(url);
    const testPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd'
    ];

    // Only test if URL has parameters
    if (urlObj.search) {
      for (const payload of testPayloads) {
        try {
          const testUrl = new URL(url);
          testUrl.searchParams.forEach((value, key) => {
            testUrl.searchParams.set(key, payload);
          });

          const response = await fetch(testUrl.toString(), {
            signal: AbortSignal.timeout(10000)
          });

          const responseText = await response.text();
          
          if (responseText.includes('root:') || responseText.includes('localhost') || 
              responseText.includes('# Copyright')) {
            result.vulnerabilityTests.directoryTraversal = true;
            result.securityIssues.push({
              type: 'injection',
              severity: 'critical',
              title: 'Directory Traversal Vulnerability',
              description: 'Application is vulnerable to directory traversal attacks',
              evidence: `Payload: ${payload}`,
              recommendation: 'Implement proper input validation and sanitization',
              cvssScore: 9.1
            });
            break;
          }
        } catch (error) {
          // Test failed, continue
        }
      }
    }
  }

  private checkInformationDisclosure(html: string, headers: Record<string, string>, result: WebSecurityResult): void {
    // Check for server information disclosure
    const server = headers['server'];
    if (server && (server.includes('Apache') || server.includes('nginx') || server.includes('IIS'))) {
      const versionMatch = server.match(/(\d+\.\d+)/);
      if (versionMatch) {
        result.securityIssues.push({
          type: 'information_disclosure',
          severity: 'low',
          title: 'Server Version Disclosure',
          description: 'Web server version information is exposed in HTTP headers',
          evidence: `Server: ${server}`,
          recommendation: 'Hide server version information in HTTP headers'
        });
      }
    }

    // Check for technology stack disclosure in HTML
    const techIndicators = [
      { pattern: /powered by [^<\n]+/gi, name: 'Technology Stack' },
      { pattern: /built with [^<\n]+/gi, name: 'Framework Information' },
      { pattern: /generator.*content="[^"]+"/gi, name: 'Generator Meta Tag' },
      { pattern: /X-Powered-By/gi, name: 'X-Powered-By Header' }
    ];

    techIndicators.forEach(indicator => {
      const matches = html.match(indicator.pattern);
      if (matches && matches.length > 0) {
        result.securityIssues.push({
          type: 'information_disclosure',
          severity: 'low',
          title: `${indicator.name} Disclosure`,
          description: `Technology information is exposed which could aid attackers`,
          evidence: matches[0],
          recommendation: 'Remove or obfuscate technology stack information from HTML and headers'
        });
      }
    });

    // Check for commented-out sensitive information
    const commentPatterns = [
      /<!--.*?password.*?-->/gi,
      /<!--.*?secret.*?-->/gi,
      /<!--.*?api[_-]?key.*?-->/gi,
      /<!--.*?token.*?-->/gi
    ];

    commentPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        result.securityIssues.push({
          type: 'information_disclosure',
          severity: 'medium',
          title: 'Sensitive Information in Comments',
          description: 'HTML comments may contain sensitive information',
          recommendation: 'Remove sensitive information from HTML comments before deployment'
        });
      }
    });
  }

  private calculateSecurityScore(result: WebSecurityResult): void {
    let score = 100;

    result.securityIssues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    });

    result.securityScore = Math.max(0, Math.min(100, score));
  }
}