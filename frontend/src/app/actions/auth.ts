"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  // Call FastAPI to clear cookies server-side
  if (token) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `access_token=${token}` },
    }).catch(() => {});
  }
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  redirect("/login");
}
