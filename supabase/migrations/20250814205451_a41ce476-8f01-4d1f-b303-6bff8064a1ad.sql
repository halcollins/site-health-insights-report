-- Drop all existing INSERT policies for analysis_reports
DROP POLICY IF EXISTS "analysis_reports_insert_policy" ON public.analysis_reports;
DROP POLICY IF EXISTS "analysis_reports_anonymous_insert_policy" ON public.analysis_reports;

-- Create new INSERT policy that allows anonymous users (matching leads table)
CREATE POLICY "analysis_reports_anonymous_insert_policy" 
ON public.analysis_reports 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  (url IS NOT NULL) AND 
  (TRIM(BOTH FROM url) <> ''::text) AND 
  (lead_id IS NOT NULL) AND 
  (length(url) <= 2048) AND 
  (length(COALESCE(wp_version, ''::text)) <= 50) AND 
  (length(COALESCE(theme, ''::text)) <= 200) AND 
  (length(COALESCE(confidence, ''::text)) <= 20) AND 
  (length(COALESCE(risk_level, ''::text)) <= 20) AND 
  (length(COALESCE(data_source, ''::text)) <= 20) AND 
  (length(COALESCE(image_optimization, ''::text)) <= 50) AND 
  (length(COALESCE(caching, ''::text)) <= 50) AND 
  ((performance_score IS NULL) OR ((performance_score >= 0) AND (performance_score <= 100))) AND 
  ((mobile_score IS NULL) OR ((mobile_score >= 0) AND (mobile_score <= 100))) AND 
  ((plugins IS NULL) OR (plugins >= 0))
);