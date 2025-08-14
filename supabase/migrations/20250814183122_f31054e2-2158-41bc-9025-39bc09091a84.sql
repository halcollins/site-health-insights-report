-- Fix RLS policy for leads table to allow anonymous insertions
DROP POLICY IF EXISTS "Anonymous can insert leads" ON public.leads;

-- Create a proper RLS policy for anonymous lead creation
CREATE POLICY "Allow anonymous lead insertion" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also ensure the analysis_reports table allows anonymous inserts
DROP POLICY IF EXISTS "Anonymous can insert analysis reports" ON public.analysis_reports;

CREATE POLICY "Allow anonymous analysis report insertion" 
ON public.analysis_reports 
FOR INSERT 
TO anon, authenticated  
WITH CHECK (true);