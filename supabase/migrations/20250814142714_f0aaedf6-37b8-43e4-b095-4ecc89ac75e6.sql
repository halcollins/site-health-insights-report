-- Fix critical security vulnerability: Remove public read access to leads table
-- Only authenticated users should be able to view leads (business owners/admins)

-- Drop the overly permissive policy
DROP POLICY "Anyone can view their own leads" ON public.leads;

-- Create a secure policy that only allows authenticated users to view leads
-- This assumes business owners/admins will be the ones viewing lead data
CREATE POLICY "Only authenticated users can view leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the insert policy for anonymous lead generation
-- The existing "Anyone can insert leads" policy is appropriate for lead capture forms