-- Fix critical security vulnerability: Restrict leads access to authorized roles only
-- Split into separate transactions to handle enum addition properly

-- Add the 'sales' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';