-- Fix the leads table RLS policy to allow anonymous users to insert leads
-- This is for lead generation, so anonymous users need to be able to submit their info

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;

-- Create a new policy that allows anyone to insert leads with proper validation
CREATE POLICY "leads_anonymous_insert_policy" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  -- Basic validation - ensure required fields are not null and not empty
  name IS NOT NULL AND TRIM(name) != '' AND length(name) <= 100 AND
  email IS NOT NULL AND TRIM(email) != '' AND length(email) <= 255 AND
  website_url IS NOT NULL AND TRIM(website_url) != '' AND length(website_url) <= 2048 AND
  -- Email format validation
  email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
  -- Company is optional but if provided, must not exceed length
  (company IS NULL OR length(company) <= 200)
);