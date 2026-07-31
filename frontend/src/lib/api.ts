/*
  Thin fetch wrapper around the HireSignal API.

  - Reads the JWT from localStorage and attaches it as a Bearer token.
  - Accepts JSON, x-www-form-urlencoded, or FormData bodies (the backend uses
    all three: JSON for register/otp, form for login, multipart for uploads).
  - Normalizes FastAPI error bodies ({detail: ...}) into a thrown ApiError.
*/

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

const TOKEN_KEY = "hs_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

type Body =
  | { json: unknown }
  | { form: Record<string, string> }
  | { formData: FormData }
  | undefined;

interface Options {
  method?: string;
  body?: Body;
  auth?: boolean; // attach the bearer token (default true)
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (body && "json" in body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body.json);
  } else if (body && "form" in body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body.form).toString();
  } else if (body && "formData" in body) {
    payload = body.formData; // browser sets the multipart boundary
  }

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}
