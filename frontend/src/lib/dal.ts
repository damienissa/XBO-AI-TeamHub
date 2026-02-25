import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member";
  is_active: boolean;
}

export const verifySession = cache(async (): Promise<SessionUser> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    redirect("/login?reason=unauthenticated");
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
    {
      headers: { Cookie: `access_token=${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    redirect("/login?reason=expired");
  }

  return res.json();
});
