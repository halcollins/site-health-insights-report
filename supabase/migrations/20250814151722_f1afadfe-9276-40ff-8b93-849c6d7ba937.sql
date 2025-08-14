-- Fix lead creation failure for anonymous users
-- The current RLS policy requires authentication but lead capture should work for anonymous visitors

-- Drop the current restrictive INSERT policy
DROP POLICY "Anyone can insert leads" ON public.leads;

-- Create a new policy that explicitly allows anonymous lead creation
-- This is needed for the lead capture form to work for potential customers
CREATE POLICY "Anonymous users can insert leads" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also ensure the table has RLS enabled (should already be enabled)
-- But adding this for completeness
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;