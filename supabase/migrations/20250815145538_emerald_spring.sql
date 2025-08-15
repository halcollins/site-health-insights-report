-- Fix RLS policy for leads table to allow anonymous insertions
-- This resolves the "new row violates row-level security policy" error

-- Ensure RLS is enabled on the leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop any existing INSERT policies on the leads table to avoid conflicts
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "Allow all lead insertions" ON public.leads;
DROP POLICY IF EXISTS "Enable anonymous lead insertion" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy_anon_authenticated" ON public.leads;
DROP POLICY IF EXISTS "allow_anon_authenticated_insert_leads" ON public.leads;

-- Create a new policy that explicitly allows anonymous and authenticated users to insert leads
CREATE POLICY "allow_anon_authenticated_insert_leads" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);