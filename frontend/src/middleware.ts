import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(process.env.NEXT_PUBLIC_SESSION_SECRET);

const protectedRoutes = ["/board", "/dashboard", "/portal", "/wiki"];
const publicRoutes = ["/login"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((r) => path.startsWith(r));
  const isPublicRoute = publicRoutes.some((r) => path.startsWith(r));
  const token = req.cookies.get("access_token")?.value;

  if (isProtectedRoute) {
    if (!token) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("reason", "unauthenticated");
      return NextResponse.redirect(url);
    }
    // Verify JWT at edge — if expired/invalid, redirect to /login?reason=expired
    try {
      await jwtVerify(token, SECRET_KEY);
    } catch {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("reason", "expired");
      return NextResponse.redirect(url);
    }
  }

  if (isPublicRoute && token) {
    // Already authenticated — redirect away from login
    try {
      await jwtVerify(token, SECRET_KEY);
      return NextResponse.redirect(new URL("/board", req.nextUrl));
    } catch {
      // Invalid token on public route — let them stay on login
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
