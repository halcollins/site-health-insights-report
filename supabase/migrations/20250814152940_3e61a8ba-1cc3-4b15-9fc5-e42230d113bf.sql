-- Drop existing INSERT policy and recreate it
DROP POLICY IF EXISTS "Anonymous users can insert leads" ON public.leads;

-- Create a new policy that explicitly allows anonymous users to insert leads
CREATE POLICY "Allow anonymous lead insertion" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also ensure RLS is enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;