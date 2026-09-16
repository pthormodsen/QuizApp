// In dev, hit the backend directly on :8080. In a production build, default to
// a relative path so requests go through the same-origin reverse proxy (nginx)
// that sits in front of both the frontend and backend containers - this avoids
// needing CORS at all in production. Override at build time with VITE_API_BASE_URL.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "");
const TOKEN_KEY = "quizapp_token";

class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized: (() => void) | null = null;

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    onUnauthorized?.();
  }

  return response;
}

async function toApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  try {
    const data = await response.json();
    const message = typeof data?.error === "string" ? data.error : fallbackMessage;
    const fieldErrors =
      data?.fieldErrors && typeof data.fieldErrors === "object" ? data.fieldErrors : undefined;
    return new ApiError(response.status, message, fieldErrors);
  } catch {
    return new ApiError(response.status, fallbackMessage);
  }
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(path, { signal });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
  return response.json();
}

async function apiDelete(path: string): Promise<void> {
  const response = await apiFetch(path, { method: "DELETE" });
  if (!response.ok) {
    throw await toApiError(response, `Request failed (${response.status})`);
  }
}

export {
  ApiError,
  getToken,
  setToken,
  clearToken,
  setUnauthorizedHandler,
  apiFetch,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
};
