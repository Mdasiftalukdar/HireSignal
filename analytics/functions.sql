-- ============================================================================
-- HireSignal - stored function: a parameterised weekly summary.
-- Usage:  SELECT * FROM weekly_summary();      -- last 8 weeks
--         SELECT * FROM weekly_summary(12);    -- last 12 weeks
-- ============================================================================

CREATE OR REPLACE FUNCTION weekly_summary(weeks_back int DEFAULT 8)
RETURNS TABLE(week date, applications bigint, offers bigint, rejections bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    date_trunc('week', created_at)::date AS week,
    count(*)                                   AS applications,
    count(*) FILTER (WHERE status = 'offer')   AS offers,
    count(*) FILTER (WHERE status = 'rejected') AS rejections
  FROM applications
  WHERE created_at >= now() - make_interval(weeks => weeks_back)
  GROUP BY 1
  ORDER BY 1;
$$;
