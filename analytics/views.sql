-- ============================================================================
-- HireSignal - reporting views (the "semantic layer" Power BI connects to).
-- Re-runnable (CREATE OR REPLACE). Showcases window functions, CTEs, CASE
-- aggregation, and JSONB unnesting.
-- ============================================================================

-- 1) Application pipeline funnel (snapshot by current stage)
CREATE OR REPLACE VIEW v_application_funnel AS
SELECT
  status::text AS stage,
  CASE status
    WHEN 'applied' THEN 1 WHEN 'screening' THEN 2 WHEN 'technical' THEN 3
    WHEN 'offer' THEN 4 WHEN 'rejected' THEN 5 END AS stage_order,
  count(*) AS applications
FROM applications
GROUP BY status
ORDER BY stage_order;

-- 2) Applications per day + rolling 7-day total (window function)
CREATE OR REPLACE VIEW v_applications_daily AS
WITH daily AS (
  SELECT date_trunc('day', created_at)::date AS day, count(*) AS applications
  FROM applications
  GROUP BY 1
)
SELECT
  day,
  applications,
  SUM(applications) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d
FROM daily
ORDER BY day;

-- 3) Conversion KPIs (single row; CASE / FILTER aggregation)
CREATE OR REPLACE VIEW v_conversion_metrics AS
SELECT
  count(*) AS total_applications,
  count(*) FILTER (WHERE status IN ('screening','technical','offer')) AS reached_screening,
  count(*) FILTER (WHERE status IN ('technical','offer'))            AS reached_technical,
  count(*) FILTER (WHERE status = 'offer')                            AS offers,
  count(*) FILTER (WHERE status = 'rejected')                         AS rejected,
  round(100.0 * count(*) FILTER (WHERE status IN ('technical','offer')) / NULLIF(count(*),0), 1) AS technical_rate_pct,
  round(100.0 * count(*) FILTER (WHERE status = 'offer')              / NULLIF(count(*),0), 1) AS offer_rate_pct
FROM applications;

-- 4) Most common MISSING skills across analyses (JSONB unnest + RANK)
CREATE OR REPLACE VIEW v_skill_gaps AS
SELECT skill, count(*) AS times_missing,
       RANK() OVER (ORDER BY count(*) DESC) AS gap_rank
FROM analyses a, LATERAL jsonb_array_elements_text(a.missing_skills) AS skill
WHERE a.status = 'completed'
GROUP BY skill
ORDER BY times_missing DESC;

-- 5) Most common MATCHED skills (candidate strengths)
CREATE OR REPLACE VIEW v_skill_strengths AS
SELECT skill, count(*) AS times_matched,
       RANK() OVER (ORDER BY count(*) DESC) AS strength_rank
FROM analyses a, LATERAL jsonb_array_elements_text(a.matched_skills) AS skill
WHERE a.status = 'completed'
GROUP BY skill
ORDER BY times_matched DESC;

-- 6) Match-score summary per résumé
CREATE OR REPLACE VIEW v_match_scores AS
SELECT r.id AS resume_id, r.filename,
       count(a.id) AS analyses,
       round(avg(a.match_score), 1) AS avg_match_score,
       min(a.match_score) AS min_score,
       max(a.match_score) AS max_score
FROM resumes r
LEFT JOIN analyses a ON a.resume_id = r.id AND a.status = 'completed'
GROUP BY r.id, r.filename
ORDER BY avg_match_score DESC NULLS LAST;

-- 7) Postings & average salary by company
CREATE OR REPLACE VIEW v_company_activity AS
SELECT company,
       count(*) AS jobs,
       count(*) FILTER (WHERE is_active) AS active_jobs,
       round(avg((salary_min + salary_max) / 2.0)) AS avg_salary_mid
FROM jobs
GROUP BY company
ORDER BY jobs DESC;

-- 8) Applications by the job's source channel
CREATE OR REPLACE VIEW v_applications_by_source AS
SELECT j.source, count(*) AS applications
FROM applications a JOIN jobs j ON j.id = a.job_id
GROUP BY j.source
ORDER BY applications DESC;
