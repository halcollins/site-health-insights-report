-- Fix security vulnerability: Restrict analysis_reports read access to authenticated users only
-- Keep INSERT policy as is to allow anonymous form submissions

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "analysis_reports_select_policy" ON public.analysis_reports;

-- Create a new SELECT policy that only allows authenticated users to read analysis reports
CREATE POLICY "analysis_reports_authenticated_select_policy" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (true);

-- Also fix the leads table while we're at it for the previous security issue
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;

-- Create a new SELECT policy that only allows authenticated users to read leads
CREATE POLICY "leads_authenticated_select_policy" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (true);

-- Keep INSERT policies as they are to allow anonymous form submissions
-- analysis_reports_insert_policy and leads_insert_policy remain unchanged