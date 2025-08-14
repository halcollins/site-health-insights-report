-- Fix security warning: Set search_path for security definer function
-- Need to drop dependent policies first, then recreate everything

-- Drop policies that depend on the function
DROP POLICY "Admins can view all roles" ON public.user_roles;
DROP POLICY "Only admin users can view leads" ON public.leads;

-- Drop and recreate the function with proper search_path setting
DROP FUNCTION public.has_role(_user_id UUID, _role app_role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate the policies with the updated function
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admin users can view leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));