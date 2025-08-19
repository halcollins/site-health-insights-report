# Website Analysis Application

## Project Overview
A professional website analysis tool that generates leads and provides comprehensive website insights. Successfully migrated from Lovable to Replit environment.

## Architecture
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Routing**: Wouter (replaced React Router for Replit compatibility)
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (migrated from Supabase)
- **Analysis Engine**: Server-side website analysis with performance metrics, WordPress detection, and security checks

## Recent Changes (August 2025)

### Security Enhancement Update
- **Comprehensive Security Scanning**: Added WordPress security scanner and general web security tests
- **Penetration Testing Features**: Implemented WPScan-like functionality and OWASP vulnerability detection
- **Enhanced Database Schema**: Added security_findings table and security-related fields to analysis_reports
- **Advanced Security Analysis**: WordPress version vulnerability detection, security header analysis, SSL/TLS testing
- **Vulnerability Detection**: Directory traversal testing, information disclosure checks, file exposure detection
- **Frontend Security Display**: Comprehensive security assessment UI with detailed findings and remediation recommendations

### Migration from Lovable to Replit (December 2024)
- **Database Migration**: Migrated from Supabase to Replit PostgreSQL using Drizzle ORM
- **Schema**: Created leads and analysis_reports tables with proper relations
- **API Migration**: Ported Supabase Edge Functions to Express.js server routes
- **Frontend Updates**: Replaced Supabase client calls with server API endpoints
- **Routing**: Migrated from React Router to Wouter for better Replit compatibility
- **Dependencies**: Removed all Supabase dependencies and cleaned up unused code

### Database Schema
- **Leads table**: Stores contact information and website URLs
- **Analysis Reports table**: Enhanced with security findings, missing headers, and overall security scores
- **Security Findings table**: Detailed vulnerability tracking with severity levels, CVE IDs, and CVSS scores
- **Enums**: Risk levels, data sources, confidence levels, vulnerability types, severity levels

### Key Features
- Lead capture with contact form
- Real-time website analysis
- Performance score calculation
- WordPress detection and analysis
- **Comprehensive Security Scanning**: WordPress vulnerability detection, security header analysis, SSL/TLS testing
- **Penetration Testing**: Directory traversal, information disclosure, file exposure checks
- **Vulnerability Database**: CVE tracking, CVSS scoring, detailed remediation recommendations
- Risk level calculation with security-adjusted scoring
- Technology stack detection
- Mobile performance analysis
- Enhanced recommendations with security focus

## User Preferences
- Technical implementation preferred over mock data
- Focus on robust security practices
- Maintain client/server separation
- Use authentic data sources only

## Development Guidelines
- Follow Replit full-stack JavaScript patterns
- Use Drizzle ORM for all database operations
- Implement proper error handling and validation
- Maintain type safety throughout the application
- Use environment variables for sensitive configuration