-- First, let's see what policies currently exist and remove ALL of them
DROP POLICY IF EXISTS "Allow anonymous lead insertion" ON public.leads;
DROP POLICY IF EXISTS "Anonymous can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can read leads" ON public.leads;

-- Create a simple, working policy for anonymous users
CREATE POLICY "leads_insert_policy" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also create a policy for reading (if needed)
CREATE POLICY "leads_select_policy" 
ON public.leads 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Now fix analysis_reports table too
DROP POLICY IF EXISTS "Allow anonymous analysis report insertion" ON public.analysis_reports;
DROP POLICY IF EXISTS "Anonymous can insert analysis reports" ON public.analysis_reports;
DROP POLICY IF EXISTS "Admins can read analysis reports" ON public.analysis_reports;

CREATE POLICY "analysis_reports_insert_policy" 
ON public.analysis_reports 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "analysis_reports_select_policy" 
ON public.analysis_reports 
FOR SELECT 
TO anon, authenticated
USING (true);