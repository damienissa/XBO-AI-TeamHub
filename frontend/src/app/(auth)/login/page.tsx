import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-slate-800">XBO TeamHub</h1>
        <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
      </div>
      <LoginForm />
    </div>
  );
}
