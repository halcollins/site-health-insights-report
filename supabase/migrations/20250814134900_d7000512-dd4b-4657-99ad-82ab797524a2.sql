-- Create leads table to store contact information
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  website_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create analysis_reports table to store detailed analysis results
CREATE TABLE public.analysis_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  performance_score INTEGER,
  mobile_score INTEGER,
  is_wordpress BOOLEAN DEFAULT false,
  wp_version TEXT,
  theme TEXT,
  plugins INTEGER,
  has_ssl BOOLEAN DEFAULT false,
  has_cdn BOOLEAN DEFAULT false,
  image_optimization TEXT CHECK (image_optimization IN ('good', 'needs-improvement', 'poor')),
  caching TEXT CHECK (caching IN ('enabled', 'partial', 'disabled')),
  recommendations JSONB,
  technologies JSONB,
  data_source TEXT CHECK (data_source IN ('real', 'estimated')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  risk_level TEXT CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required for lead generation)
CREATE POLICY "Anyone can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view their own leads" 
ON public.leads 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert analysis reports" 
ON public.analysis_reports 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view analysis reports" 
ON public.analysis_reports 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_website_url ON public.leads(website_url);
CREATE INDEX idx_analysis_reports_lead_id ON public.analysis_reports(lead_id);
CREATE INDEX idx_analysis_reports_risk_level ON public.analysis_reports(risk_level);