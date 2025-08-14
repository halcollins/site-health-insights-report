-- Fix critical security vulnerability: Restrict analysis_reports access to admin users only
-- Analysis reports contain sensitive customer business intelligence data linked to leads

-- Drop the overly permissive policy that allows any authenticated user to view analysis reports
DROP POLICY "Only authenticated users can view analysis reports" ON public.analysis_reports;

-- Create secure policy that only allows admin users to view analysis reports
-- This protects customer business intelligence and analysis data
CREATE POLICY "Only admin users can view analysis reports" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Keep the insert policy for analysis functionality
-- The existing "Anyone can insert analysis reports" policy is needed for the automated analysis service