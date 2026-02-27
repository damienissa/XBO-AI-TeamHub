"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/api/client";

const INPUT = {
  width: "100%", padding: "8px 12px", borderRadius: "6px",
  border: "1px solid #E9E9E6", background: "#fff",
  color: "#37352F", fontSize: "14px", outline: "none",
  transition: "border-color 0.15s",
} as const;

const LABEL = {
  display: "block", fontSize: "12px", fontWeight: 500,
  color: "#73726E", marginBottom: "5px",
} as const;

export function LoginForm() {
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("reason") === "expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setIsPending(true);
    try {
      await login({ email, password });
      window.location.href = "/board";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm" style={{ borderColor: "#E9E9E6" }}>
      {isExpired && !bannerDismissed && (
        <div className="mb-4 flex items-center justify-between rounded-lg border px-3 py-2 text-xs" style={{ background: "#FFF8EC", borderColor: "#FFE5A0", color: "#7F6A1E" }}>
          <span>Session expired — please sign in again</span>
          <button onClick={() => setBannerDismissed(true)} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" style={LABEL}>Email</label>
          <input
            id="email" type="email" value={email} placeholder="you@xbo.com"
            autoComplete="email" disabled={isPending}
            onChange={(e) => setEmail(e.target.value)}
            style={INPUT}
            onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
            onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
          />
        </div>
        <div>
          <label htmlFor="password" style={LABEL}>Password</label>
          <input
            id="password" type="password" value={password}
            autoComplete="current-password" disabled={isPending}
            onChange={(e) => setPassword(e.target.value)}
            style={INPUT}
            onFocus={(e) => (e.target.style.borderColor = "#2383E2")}
            onBlur={(e) => (e.target.style.borderColor = "#E9E9E6")}
          />
        </div>
        {error && <p className="text-xs" style={{ color: "#d44c47" }} role="alert">{error}</p>}
        <button
          type="submit" disabled={isPending}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: "#2383E2" }}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
