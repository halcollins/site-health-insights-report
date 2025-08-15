# Website Analysis Application

## Project Overview
A professional website analysis tool that generates leads and provides comprehensive website insights. Successfully migrated from Lovable to Replit environment.

## Architecture
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Routing**: Wouter (replaced React Router for Replit compatibility)
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (migrated from Supabase)
- **Analysis Engine**: Server-side website analysis with performance metrics, WordPress detection, and security checks

## Recent Changes (December 2024)

### Migration from Lovable to Replit
- **Database Migration**: Migrated from Supabase to Replit PostgreSQL using Drizzle ORM
- **Schema**: Created leads and analysis_reports tables with proper relations
- **API Migration**: Ported Supabase Edge Functions to Express.js server routes
- **Frontend Updates**: Replaced Supabase client calls with server API endpoints
- **Routing**: Migrated from React Router to Wouter for better Replit compatibility
- **Dependencies**: Removed all Supabase dependencies and cleaned up unused code

### Database Schema
- **Leads table**: Stores contact information and website URLs
- **Analysis Reports table**: Stores detailed website analysis results with foreign key to leads
- **Enums**: Risk levels, data sources, confidence levels, optimization statuses

### Key Features
- Lead capture with contact form
- Real-time website analysis
- Performance score calculation
- WordPress detection and analysis
- Security assessment (SSL, CDN detection)
- Risk level calculation
- Technology stack detection
- Mobile performance analysis
- Recommendations generation

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