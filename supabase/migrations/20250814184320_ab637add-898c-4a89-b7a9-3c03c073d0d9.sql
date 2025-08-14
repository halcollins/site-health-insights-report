-- Now create the restrictive policies for leads and analysis_reports

-- Drop the overly permissive SELECT policy for leads
DROP POLICY IF EXISTS "leads_authenticated_select_policy" ON public.leads;

-- Create a new restrictive SELECT policy that only allows admin and sales roles
CREATE POLICY "leads_authorized_roles_select_policy" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'sales'::app_role)
);

-- Also restrict analysis_reports to the same roles for consistency
DROP POLICY IF EXISTS "analysis_reports_authenticated_select_policy" ON public.analysis_reports;

CREATE POLICY "analysis_reports_authorized_roles_select_policy" 
ON public.analysis_reports 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'sales'::app_role)
);

-- Keep INSERT policies unchanged to allow anonymous form submissions
-- leads_insert_policy and analysis_reports_insert_policy remain as-is