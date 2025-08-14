-- Re-enable RLS on both tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

-- Drop the existing policies that require authentication
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Only admin users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert analysis reports" ON public.analysis_reports;
DROP POLICY IF EXISTS "Only admin users can view analysis reports" ON public.analysis_reports;

-- Create new policies that allow anonymous insertions but restrict reading to admins
CREATE POLICY "Enable anonymous lead insertion" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Only authenticated admins can view leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enable anonymous analysis report insertion" 
ON public.analysis_reports 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Only authenticated admins can view analysis reports" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));