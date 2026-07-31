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

/*
  Consume a Server-Sent Events stream via fetch + ReadableStream. We use fetch
  (not EventSource) specifically so we can send the Bearer token in a header
  instead of leaking it in the URL. Resolves when the stream ends; abort via the
  provided AbortSignal.
*/
export async function streamSSE<T>(
  path: string,
  handlers: { onMessage: (data: T) => void; onError?: (detail: string) => void },
  signal: AbortSignal,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`Stream failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue; // comment / heartbeat
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const raw = dataLines.join("\n");
    if (event === "error" || event === "timeout") {
      try {
        handlers.onError?.(JSON.parse(raw).detail ?? "Stream error");
      } catch {
        handlers.onError?.("Stream error");
      }
      return;
    }
    try {
      handlers.onMessage(JSON.parse(raw) as T);
    } catch {
      /* ignore unparseable frame */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        dispatch(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      handlers.onError?.("Connection lost");
    }
  }
}
