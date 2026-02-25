"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("reason") === "expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side basic validation — inline errors per CONTEXT.md
    if (!email) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }

    startTransition(async () => {
      try {
        await login({ email, password });
        // Successful login: no toast, just redirect to /board (CONTEXT.md locked decision)
        router.push("/board");
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid email or password";
        setError(msg);  // Inline under form, not toast
      }
    });
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Session expiry banner — dismissable, shown when ?reason=expired */}
        {isExpired && !bannerDismissed && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <span>Session expired, please log in again</span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-2 text-amber-600 hover:text-amber-900"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@xbo.com"
              autoComplete="email"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isPending}
            />
          </div>

          {/* Inline error below form fields — NOT a toast (CONTEXT.md locked decision) */}
          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>

          {/* NO Sign Up link — admin-creates-users only (CONTEXT.md locked decision) */}
        </form>
      </CardContent>
    </Card>
  );
}
