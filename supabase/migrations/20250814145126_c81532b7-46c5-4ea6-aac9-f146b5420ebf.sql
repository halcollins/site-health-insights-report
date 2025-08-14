-- Fix critical security vulnerability: Implement role-based access for leads table
-- Customer data should only be accessible to admin users, not any authenticated user

-- First, create user roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create RLS policy for user_roles table (users can only see their own roles)
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own role (for initial setup)
CREATE POLICY "Users can insert their own role" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Now fix the leads table security vulnerability
-- Drop the overly permissive policy
DROP POLICY "Only authenticated users can view leads" ON public.leads;

-- Create secure policy that only allows admin users to view leads
CREATE POLICY "Only admin users can view leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Keep the insert policy for lead generation functionality
-- The existing "Anyone can insert leads" policy is needed for the public lead capture form