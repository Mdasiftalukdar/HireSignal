-- ============================================================================
-- HireSignal - annotated analytical queries.
-- A study/interview reference: each query notes the technique it demonstrates.
-- ============================================================================

-- 1) Pipeline funnel: how many applications sit at each stage.
--    (Simple GROUP BY aggregation.)
SELECT status, count(*) AS applications
FROM applications
GROUP BY status
ORDER BY count(*) DESC;

-- 2) Conversion rates with CASE / FILTER aggregation (one-row KPI).
SELECT
  count(*) AS total,
  round(100.0 * count(*) FILTER (WHERE status IN ('technical','offer')) / NULLIF(count(*),0), 1) AS to_technical_pct,
  round(100.0 * count(*) FILTER (WHERE status = 'offer')               / NULLIF(count(*),0), 1) AS to_offer_pct
FROM applications;

-- 3) Applications per day (date_trunc grouping).
SELECT date_trunc('day', created_at)::date AS day, count(*) AS applications
FROM applications
GROUP BY 1 ORDER BY 1;

-- 4) Rolling 7-day application count (WINDOW: SUM OVER a moving frame).
WITH daily AS (
  SELECT date_trunc('day', created_at)::date AS day, count(*) AS n
  FROM applications GROUP BY 1
)
SELECT day, n,
       SUM(n) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d
FROM daily ORDER BY day;

-- 5) Cumulative applications over time (WINDOW: running total).
WITH daily AS (
  SELECT date_trunc('day', created_at)::date AS day, count(*) AS n
  FROM applications GROUP BY 1
)
SELECT day, SUM(n) OVER (ORDER BY day) AS cumulative_applications
FROM daily ORDER BY day;

-- 6) Companies ranked by application volume (WINDOW: RANK).
SELECT j.company, count(*) AS applications,
       RANK() OVER (ORDER BY count(*) DESC) AS company_rank
FROM applications a JOIN jobs j ON j.id = a.job_id
GROUP BY j.company ORDER BY applications DESC;

-- 7) Most recent application per company (WINDOW: ROW_NUMBER partitioned).
SELECT * FROM (
  SELECT j.company, a.id, a.status, a.created_at,
         ROW_NUMBER() OVER (PARTITION BY j.company ORDER BY a.created_at DESC) AS rn
  FROM applications a JOIN jobs j ON j.id = a.job_id
) t
WHERE rn = 1
ORDER BY company;

-- 8) Gap (days) between consecutive applications to the same company (WINDOW: LAG).
SELECT j.company, a.created_at::date AS applied_on,
       a.created_at::date
         - LAG(a.created_at::date) OVER (PARTITION BY j.company ORDER BY a.created_at) AS days_since_prev
FROM applications a JOIN jobs j ON j.id = a.job_id
ORDER BY j.company, a.created_at;

-- 9) Top missing skills across analyses (JSONB unnest + RANK).
SELECT skill, count(*) AS times_missing,
       RANK() OVER (ORDER BY count(*) DESC) AS gap_rank
FROM analyses a, LATERAL jsonb_array_elements_text(a.missing_skills) AS skill
GROUP BY skill ORDER BY times_missing DESC LIMIT 10;

-- 10) Top matched (strength) skills.
SELECT skill, count(*) AS times_matched
FROM analyses a, LATERAL jsonb_array_elements_text(a.matched_skills) AS skill
GROUP BY skill ORDER BY times_matched DESC LIMIT 10;

-- 11) Match-score distribution in 10-point bands (CASE bucketing).
SELECT
  CASE WHEN match_score >= 90 THEN '90-100'
       WHEN match_score >= 80 THEN '80-89'
       WHEN match_score >= 70 THEN '70-79'
       WHEN match_score >= 60 THEN '60-69'
       ELSE '<60' END AS band,
  count(*) AS analyses
FROM analyses WHERE match_score IS NOT NULL
GROUP BY band ORDER BY band DESC;

-- 12) Median match score (WINDOW/ordered-set: PERCENTILE_CONT).
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY match_score) AS median_match
FROM analyses WHERE match_score IS NOT NULL;

-- 13) Average match score per résumé, ranked (JOIN + DENSE_RANK).
SELECT r.filename, round(avg(a.match_score),1) AS avg_score,
       DENSE_RANK() OVER (ORDER BY round(avg(a.match_score),1) DESC) AS score_rank
FROM resumes r JOIN analyses a ON a.resume_id = r.id
GROUP BY r.filename ORDER BY avg_score DESC;

-- 14) Applications by source channel with % of total (WINDOW total).
SELECT j.source, count(*) AS applications,
       round(100.0 * count(*) / SUM(count(*)) OVER (), 1) AS pct_of_total
FROM applications a JOIN jobs j ON j.id = a.job_id
GROUP BY j.source ORDER BY applications DESC;

-- 15) Weekly summary via the stored function.
SELECT * FROM weekly_summary(12);

-- 16) Time in pipeline by stage (proxy for response time; date arithmetic).
SELECT status,
       round(avg(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0), 1) AS avg_days_in_stage
FROM applications
GROUP BY status ORDER BY avg_days_in_stage DESC;
