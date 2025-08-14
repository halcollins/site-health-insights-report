-- Fix critical security vulnerability: Remove public read access to analysis_reports table
-- Business intelligence data should only be accessible to authenticated users

-- Drop the overly permissive policy
DROP POLICY "Anyone can view analysis reports" ON public.analysis_reports;

-- Create a secure policy that only allows authenticated users to view analysis reports
-- This protects sensitive business intelligence and technology data
CREATE POLICY "Only authenticated users can view analysis reports" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the insert policy for analysis functionality
-- The existing "Anyone can insert analysis reports" policy is needed for the analysis service