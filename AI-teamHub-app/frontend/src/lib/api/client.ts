const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Silent token-refresh interceptor ──────────────────────────────────────────
// Deduplicates concurrent refresh calls so that if 10 queries all get a 401
// at the same time, only one POST /api/auth/refresh goes out.
let _refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

/**
 * Drop-in replacement for `fetch` that automatically refreshes the access
 * token on 401 and retries the request once.  If the refresh also fails
 * (refresh token expired) the user is redirected to /login.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });

  if (res.status !== 401) return res;

  // Access token expired — try a silent refresh
  const refreshed = await attemptRefresh();
  if (refreshed) {
    // Retry original request; browser now has a fresh access_token cookie
    return fetch(input, { ...init, credentials: "include" });
  }

  // Refresh token also gone — force re-login
  if (typeof window !== "undefined") {
    window.location.href = "/login?reason=expired";
  }
  throw new Error("Session expired — please log in again");
}
// ──────────────────────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string;
  password: string;
}

interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member";
  is_active: boolean;
}

export async function login(payload: LoginPayload): Promise<ApiUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",  // Required: sends/receives cookies cross-origin
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Login failed");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getDepartments() {
  const res = await fetch(`${API_BASE}/api/departments`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}
