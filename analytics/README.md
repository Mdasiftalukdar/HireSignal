# HireSignal — Analytics

A SQL analytics layer over the application-tracking data, plus a Power BI report.

## Contents

| File | Purpose |
|------|---------|
| `seed_data.sql` | Loads a realistic synthetic dataset (jobs, résumés, applications, analyses) |
| `views.sql` | Reporting **views** — the semantic layer Power BI connects to |
| `functions.sql` | `weekly_summary(weeks_back)` stored function |
| `analytics_queries.sql` | 16 annotated analytical queries (window functions, CTEs, CASE, LAG, ranking) |

## Apply the SQL

```bash
docker compose exec -T postgres psql -U hiresignal -d hiresignal < analytics/seed_data.sql
docker compose exec -T postgres psql -U hiresignal -d hiresignal < analytics/views.sql
docker compose exec -T postgres psql -U hiresignal -d hiresignal < analytics/functions.sql
```

## Reporting views

| View | Shows |
|------|-------|
| `v_application_funnel` | Applications by pipeline stage |
| `v_applications_daily` | Daily applications + rolling 7-day total |
| `v_conversion_metrics` | Funnel conversion KPIs (one row) |
| `v_skill_gaps` | Most common missing skills |
| `v_skill_strengths` | Most common matched skills |
| `v_match_scores` | Match-score summary per résumé |
| `v_company_activity` | Postings & average salary by company |
| `v_applications_by_source` | Applications by source channel |

## Connect Power BI Desktop → PostgreSQL

1. Open **Power BI Desktop** → **Get Data** → **PostgreSQL database**.
2. **Server:** `localhost:5432`  ·  **Database:** `hiresignal`  ·  Data Connectivity: **Import**.
3. Credentials: **Database** auth → user `hiresignal`, password `hiresignal_dev_pw`.
   (If prompted about encryption, you can disable it for local dev.)
4. In the Navigator, select the `v_*` views → **Load**.

## Suggested 3-page report

- **Page 1 — Application Pipeline:** funnel visual from `v_application_funnel`; KPI cards from
  `v_conversion_metrics` (total, to-technical %, offer %); a line chart of `v_applications_daily`
  (`applications` and `rolling_7d`).
- **Page 2 — Skill Insights:** bar chart of `v_skill_gaps` (top missing) and `v_skill_strengths`
  (top matched); a card for average match score from `v_match_scores`.
- **Page 3 — Market & Activity:** `v_company_activity` (jobs/avg salary by company) and
  `v_applications_by_source` (channel mix).

## Handy DAX measures

```DAX
Offer Rate % = DIVIDE( CALCULATE(COUNTROWS('v_application_funnel'), 'v_application_funnel'[stage] = "offer"),
                       SUM('v_application_funnel'[applications]) )

Total Applications = SUM('v_application_funnel'[applications])
```
