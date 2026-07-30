-- ============================================================================
-- HireSignal - analytics sample data
-- Resets jobs / resumes / applications / analyses to a rich SYNTHETIC dataset so
-- the reporting views and Power BI dashboard have realistic volume to show.
-- Users/auth are untouched. Safe to re-run (it truncates first).
--
-- Note: row-varying values are derived from the row number (g.i), NOT from an
-- uncorrelated `random()` subquery - an uncorrelated subquery is evaluated ONCE
-- and cross-joined to every row (which made every row identical on the first try).
-- ============================================================================

BEGIN;

TRUNCATE TABLE analyses, applications, jobs, resumes RESTART IDENTITY CASCADE;

-- ---- Résumés (candidate versions) ----
INSERT INTO resumes (filename, content_text, created_at, updated_at)
SELECT fn, 'Sample résumé text for ' || fn, now() - (random() * interval '120 days'), now()
FROM (VALUES ('swe_resume.pdf'), ('data_analyst_resume.pdf'), ('ml_resume.pdf')) AS r(fn);

-- ---- Jobs (~45 postings across companies / seniority / source) ----
INSERT INTO jobs (title, company, location, seniority, salary_min, salary_max, source, is_active, created_at, updated_at)
SELECT
  (ARRAY['Backend Engineer','Data Analyst','ML Engineer','Full Stack Developer','Data Engineer','Software Engineer','BI Analyst','Platform Engineer'])[1 + (i % 8)],
  (ARRAY['Cohere','Shopify','Wealthsimple','RBC Borealis','TD Layer6','Ada','Hootsuite','1Password','ATB Financial','Jobber'])[1 + (i % 10)],
  (ARRAY['Toronto, ON','Vancouver, BC','Remote (Canada)','Edmonton, AB','Montreal, QC'])[1 + (i % 5)],
  (ARRAY['Junior','Mid','Senior','Staff'])[1 + (i % 4)],
  70000 + (i % 6) * 10000,
  100000 + (i % 6) * 12000,
  (ARRAY['LinkedIn','Indeed','Company Site','Referral','Job Bank'])[1 + (i % 5)],
  (i % 7 <> 0),
  now() - (random() * interval '90 days'),
  now()
FROM generate_series(1, 45) AS s(i);

-- ---- Applications (~130) with a decaying funnel (weighted array by row number) ----
INSERT INTO applications (job_id, resume_id, status, match_score, notes, created_at, updated_at)
SELECT
  1 + (g.i % 45),
  1 + (g.i % 3),
  (ARRAY[
    'applied','applied','applied','applied','applied','applied',
    'screening','screening','screening','screening','screening',
    'technical','technical','technical','technical',
    'offer','offer',
    'rejected','rejected','rejected'
  ])[1 + (g.i % 20)]::application_status,
  40 + (g.i % 56),
  NULL,
  now() - (random() * interval '90 days'),
  now()
FROM generate_series(1, 130) AS g(i);

-- ---- Analyses (~80 completed match reports; skill sets vary per row via g.i + ord) ----
INSERT INTO analyses (resume_id, job_description, status, match_score, matched_skills, missing_skills, recommendation, created_at, updated_at)
SELECT
  1 + (g.i % 3),
  'Sample job description #' || g.i,
  'completed'::analysis_status,
  40 + (g.i % 56),
  sk.matched,
  sk.missing,
  'Auto-generated sample analysis',
  now() - (random() * interval '90 days'),
  now()
FROM generate_series(1, 80) AS g(i)
CROSS JOIN LATERAL (
  SELECT
    COALESCE(to_jsonb(array_agg(u.skill) FILTER (WHERE (g.i + u.ord) % 3 = 0)), '[]'::jsonb) AS matched,
    COALESCE(to_jsonb(array_agg(u.skill) FILTER (WHERE (g.i + u.ord) % 3 <> 0 AND (g.i * 2 + u.ord) % 5 < 2)), '[]'::jsonb) AS missing
  FROM unnest(ARRAY[
    'Python','SQL','FastAPI','PostgreSQL','Redis','Docker','Kafka','GraphQL','AWS',
    'Power BI','Tableau','Pandas','scikit-learn','Airflow','Spark','Kubernetes',
    'Terraform','React','Excel','Statistics'
  ]) WITH ORDINALITY AS u(skill, ord)
) AS sk;

COMMIT;
