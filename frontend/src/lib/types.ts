/* Shapes mirrored from the FastAPI schemas so the UI is fully typed. */

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface Usage {
  today: number;
  total: number;
  daily_limit: number;
  unlimited: boolean;
  has_api_key: boolean;
}

export interface SavedResume {
  id: number;
  label: string | null;
  filename: string;
}

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type Decision =
  | "none"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "accepted";

export interface Analysis {
  id: number;
  resume_id: number;
  status: AnalysisStatus;
  match_score: number | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  keyword_matches: string[] | null;
  keyword_gaps: string[] | null;
  section_suggestions: string[] | null;
  weaknesses: string[] | null;
  suggested_bullets: string[] | null;
  resume_summary: string | null;
  job_summary: string | null;
  applied: boolean;
  decision: Decision | null;
  recommendation: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerItem {
  id: number;
  created_at: string;
  status: string;
  match_score: number | null;
  resume_label: string | null;
  resume_summary: string | null;
  job_summary: string | null;
  applied: boolean;
  decision: string | null;
}

export interface AnalysisSubmit {
  analysis_id: number;
  resume_id: number;
  status: AnalysisStatus;
  s3_key: string;
}
