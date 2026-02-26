const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
