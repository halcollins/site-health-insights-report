-- Re-enable RLS and create a simple policy that allows anyone to insert
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies and start fresh
DROP POLICY IF EXISTS "Allow anonymous lead insertion" ON public.leads;
DROP POLICY IF EXISTS "Only admin users can view leads" ON public.leads;

-- Create a simple policy that allows any role to insert
CREATE POLICY "enable_insert_for_all_users" ON public.leads
  FOR INSERT WITH CHECK (true);

-- Create a policy that only allows authenticated admin users to view leads  
CREATE POLICY "enable_select_for_admin_users" ON public.leads
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));