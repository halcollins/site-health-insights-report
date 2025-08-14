-- Drop existing policies and recreate with proper security

-- Drop existing policies on analysis_reports
DROP POLICY IF EXISTS "Anyone can insert analysis reports" ON public.analysis_reports;
DROP POLICY IF EXISTS "Only admin users can view analysis reports" ON public.analysis_reports;

-- Re-enable RLS on leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads table (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Anyone can insert leads') THEN
        CREATE POLICY "Anyone can insert leads" 
        ON public.leads 
        FOR INSERT 
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Only admin users can view leads') THEN
        CREATE POLICY "Only admin users can view leads" 
        ON public.leads 
        FOR SELECT 
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;
END $$;

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