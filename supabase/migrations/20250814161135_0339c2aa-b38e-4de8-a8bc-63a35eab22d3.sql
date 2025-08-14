-- Drop all existing policies and create simpler ones
DROP POLICY IF EXISTS "Enable anonymous lead insertion" ON public.leads;
DROP POLICY IF EXISTS "Only authenticated admins can view leads" ON public.leads;
DROP POLICY IF EXISTS "Enable anonymous analysis report insertion" ON public.analysis_reports;
DROP POLICY IF EXISTS "Only authenticated admins can view analysis reports" ON public.analysis_reports;

-- Create very permissive insertion policies for testing
CREATE POLICY "Allow all lead insertions" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all analysis report insertions" 
ON public.analysis_reports 
FOR INSERT 
WITH CHECK (true);

-- Restrict viewing to authenticated admin users only
CREATE POLICY "Admin read leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin read reports" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));