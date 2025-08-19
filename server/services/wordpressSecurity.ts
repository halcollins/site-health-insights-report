interface WordPressSecurityIssue {
  type: 'version' | 'plugin' | 'theme' | 'config' | 'file' | 'user_enum';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
  cvssScore?: number;
  cveId?: string;
}

interface WPSecurityResult {
  isWordPress: boolean;
  version?: string;
  isVersionOutdated?: boolean;
  exposedFiles: string[];
  securityIssues: WordPressSecurityIssue[];
  configurationIssues: string[];
  userEnumerationPossible: boolean;
  adminAccessible: boolean;
  directoryListingEnabled: boolean;
  debugModeEnabled: boolean;
  xmlrpcEnabled: boolean;
}

export class WordPressSecurityScanner {
  private readonly VULNERABLE_WP_VERSIONS = [
    { version: '6.3.0', cves: ['CVE-2023-38000'] },
    { version: '6.2.0', cves: ['CVE-2023-2745'] },
    { version: '6.1.0', cves: ['CVE-2023-2745'] },
    { version: '6.0.0', cves: ['CVE-2022-43497'] },
    // Add more vulnerable versions as needed
  ];

  private readonly WP_SENSITIVE_FILES = [
    '/wp-config.php',
    '/wp-config.php.bak',
    '/wp-config.php.old',
    '/wp-config.php.save',
    '/.wp-config.php.swp',
    '/wp-admin/setup-config.php',
    '/wp-content/debug.log',
    '/wp-includes/wp-config.php',
    '/wordpress/wp-config.php',
    '/wp/wp-config.php',
    '/blog/wp-config.php',
    '/wp-content/uploads/.htaccess',
    '/readme.html',
    '/license.txt',
    '/wp-admin/install.php',
    '/wp-admin/upgrade.php'
  ];

  async scanWordPressSecurity(url: string, html: string, headers: Record<string, string>): Promise<WPSecurityResult> {
    const result: WPSecurityResult = {
      isWordPress: this.detectWordPress(html),
      exposedFiles: [],
      securityIssues: [],
      configurationIssues: [],
      userEnumerationPossible: false,
      adminAccessible: false,
      directoryListingEnabled: false,
      debugModeEnabled: false,
      xmlrpcEnabled: false
    };

    if (!result.isWordPress) {
      return result;
    }

    // Extract WordPress version
    result.version = this.extractWordPressVersion(html);
    
    // Check for version vulnerabilities
    if (result.version) {
      result.isVersionOutdated = this.checkVersionVulnerabilities(result.version, result.securityIssues);
    }

    // Check for exposed sensitive files
    await this.checkExposedFiles(url, result);

    // Check various security configurations
    await this.checkSecurityConfigurations(url, html, headers, result);

    // Check for information disclosure
    this.checkInformationDisclosure(html, result);

    // Check for debug mode
    this.checkDebugMode(html, result);

    return result;
  }

  private detectWordPress(html: string): boolean {
    const wpIndicators = [
      '/wp-content/',
      '/wp-includes/',
      'wp-json',
      'wordpress',
      'wp_enqueue_script',
      'wp-admin',
      '/wp-login.php'
    ];
    
    const htmlLower = html.toLowerCase();
    return wpIndicators.some(indicator => htmlLower.includes(indicator));
  }

  private extractWordPressVersion(html: string): string | undefined {
    // Try multiple methods to extract version
    const patterns = [
      /wp-includes\/js\/wp-emoji-release\.min\.js\?ver=([0-9.]+)/,
      /<meta name="generator" content="WordPress ([0-9.]+)"/,
      /wp-content\/themes\/[^\/]+\/style\.css\?ver=([0-9.]+)/,
      /wp-includes\/css\/dist\/block-library\/style\.min\.css\?ver=([0-9.]+)/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private checkVersionVulnerabilities(version: string, securityIssues: WordPressSecurityIssue[]): boolean {
    let isOutdated = false;
    
    // Check against known vulnerable versions
    const vulnerable = this.VULNERABLE_WP_VERSIONS.find(v => version.startsWith(v.version));
    
    if (vulnerable) {
      isOutdated = true;
      securityIssues.push({
        type: 'version',
        severity: 'high',
        title: `Vulnerable WordPress Version: ${version}`,
        description: `WordPress version ${version} contains known security vulnerabilities.`,
        evidence: `Version: ${version}`,
        recommendation: 'Update WordPress to the latest stable version immediately.',
        cveId: vulnerable.cves[0],
        cvssScore: 8.5
      });
    }

    // Check if version is very old (more than 6 months old from current)
    const versionParts = version.split('.').map(Number);
    if (versionParts[0] < 6 || (versionParts[0] === 6 && versionParts[1] < 4)) {
      isOutdated = true;
      securityIssues.push({
        type: 'version',
        severity: 'medium',
        title: 'Outdated WordPress Version',
        description: `WordPress version ${version} is outdated and may contain security vulnerabilities.`,
        evidence: `Version: ${version}`,
        recommendation: 'Update WordPress to the latest stable version for security patches and improvements.'
      });
    }

    return isOutdated;
  }

  private async checkExposedFiles(url: string, result: WPSecurityResult): Promise<void> {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    for (const file of this.WP_SENSITIVE_FILES) {
      try {
        const fileUrl = `${baseUrl}${file}`;
        const response = await fetch(fileUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          result.exposedFiles.push(file);
          
          const severity = file.includes('wp-config') ? 'critical' : 
                          file.includes('debug.log') ? 'high' : 'medium';
          
          result.securityIssues.push({
            type: 'file',
            severity,
            title: `Exposed Sensitive File: ${file}`,
            description: `Sensitive WordPress file ${file} is accessible and may contain configuration data or debug information.`,
            evidence: `File accessible at: ${fileUrl}`,
            recommendation: severity === 'critical' 
              ? 'Immediately restrict access to wp-config.php files using .htaccess or server configuration.'
              : 'Restrict access to sensitive files and disable debug logging in production.'
          });
        }
      } catch (error) {
        // File not accessible, which is good
      }
    }
  }

  private async checkSecurityConfigurations(url: string, html: string, headers: Record<string, string>, result: WPSecurityResult): Promise<void> {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    // Check wp-admin accessibility
    try {
      const adminUrl = `${baseUrl}/wp-admin/`;
      const adminResponse = await fetch(adminUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        redirect: 'manual'
      });
      
      result.adminAccessible = adminResponse.status === 200;
      
      if (result.adminAccessible) {
        result.securityIssues.push({
          type: 'config',
          severity: 'medium',
          title: 'WordPress Admin Area Accessible',
          description: 'WordPress admin area is accessible without proper protection.',
          recommendation: 'Consider implementing IP restrictions, two-factor authentication, or admin area protection.'
        });
      }
    } catch (error) {
      // Admin not accessible
    }

    // Check XML-RPC
    try {
      const xmlrpcUrl = `${baseUrl}/xmlrpc.php`;
      const xmlrpcResponse = await fetch(xmlrpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>',
        signal: AbortSignal.timeout(10000)
      });
      
      if (xmlrpcResponse.ok) {
        result.xmlrpcEnabled = true;
        result.securityIssues.push({
          type: 'config',
          severity: 'medium',
          title: 'XML-RPC Enabled',
          description: 'WordPress XML-RPC is enabled and can be used for brute force attacks.',
          recommendation: 'Disable XML-RPC if not needed, or implement rate limiting and authentication.'
        });
      }
    } catch (error) {
      // XML-RPC not accessible
    }

    // Check user enumeration
    try {
      const userEnumUrl = `${baseUrl}/?author=1`;
      const userResponse = await fetch(userEnumUrl, {
        signal: AbortSignal.timeout(10000),
        redirect: 'manual'
      });
      
      if (userResponse.status === 301 || userResponse.status === 302) {
        const location = userResponse.headers.get('location');
        if (location && location.includes('/author/')) {
          result.userEnumerationPossible = true;
          result.securityIssues.push({
            type: 'user_enum',
            severity: 'low',
            title: 'User Enumeration Possible',
            description: 'WordPress allows user enumeration through author archives.',
            recommendation: 'Disable user enumeration by redirecting author pages or using security plugins.'
          });
        }
      }
    } catch (error) {
      // User enumeration check failed
    }

    // Check directory listing
    this.checkDirectoryListing(html, result);
  }

  private checkDirectoryListing(html: string, result: WPSecurityResult): void {
    const directoryListingIndicators = [
      'Index of /',
      'Directory Listing',
      '<title>Index of',
      'Parent Directory',
      '[DIR]'
    ];

    if (directoryListingIndicators.some(indicator => html.includes(indicator))) {
      result.directoryListingEnabled = true;
      result.securityIssues.push({
        type: 'config',
        severity: 'medium',
        title: 'Directory Listing Enabled',
        description: 'Server allows directory listing which can expose sensitive files.',
        recommendation: 'Disable directory listing in web server configuration.'
      });
    }
  }

  private checkInformationDisclosure(html: string, result: WPSecurityResult): void {
    // Check for exposed paths in HTML
    const exposedPaths = [
      '/wp-content/plugins/',
      '/wp-content/themes/',
      '/wp-includes/'
    ];

    exposedPaths.forEach(path => {
      const regex = new RegExp(path + '([^/\\s"\']+)', 'gi');
      const matches = html.match(regex);
      
      if (matches && matches.length > 0) {
        result.securityIssues.push({
          type: 'config',
          severity: 'low',
          title: 'WordPress Structure Information Disclosure',
          description: `WordPress directory structure is exposed in HTML source, revealing ${path} contents.`,
          recommendation: 'Consider using security plugins to hide WordPress structure information.'
        });
      }
    });
  }

  private checkDebugMode(html: string, result: WPSecurityResult): void {
    const debugIndicators = [
      'WP_DEBUG',
      'wp-content/debug.log',
      'Notice: ',
      'Warning: ',
      'Fatal error:',
      'wp_debug'
    ];

    if (debugIndicators.some(indicator => html.includes(indicator))) {
      result.debugModeEnabled = true;
      result.securityIssues.push({
        type: 'config',
        severity: 'medium',
        title: 'WordPress Debug Mode Enabled',
        description: 'WordPress debug mode is enabled, potentially exposing sensitive information.',
        recommendation: 'Disable debug mode in production by setting WP_DEBUG to false in wp-config.php.'
      });
    }
  }
}