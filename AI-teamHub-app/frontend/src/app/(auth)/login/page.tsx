import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="animate-enter">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: "#2383E2" }}>A</div>
          <span className="font-semibold text-lg" style={{ color: "#37352F" }}>AI Hub</span>
        </div>
        <p className="text-sm" style={{ color: "#9B9A97" }}>Sign in to your workspace</p>
      </div>
      <Suspense fallback={<div className="h-56 rounded-xl bg-white border animate-pulse" style={{ borderColor: "#E9E9E6" }} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
