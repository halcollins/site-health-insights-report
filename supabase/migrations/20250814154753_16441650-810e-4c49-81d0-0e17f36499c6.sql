-- Re-enable RLS and create proper policies for all tables

-- Re-enable RLS on leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads table
CREATE POLICY "Anyone can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Only admin users can view leads" 
ON public.leads 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Re-enable RLS on analysis_reports table  
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for analysis_reports table
CREATE POLICY "Anyone can insert analysis reports" 
ON public.analysis_reports 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Only admin users can view analysis reports" 
ON public.analysis_reports 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));