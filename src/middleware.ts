import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    // Already logged in — send to homepage which redirects appropriately
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Protected route — no session
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    const isApi = pathname.startsWith("/api/");
    // Don't redirect API routes — return 401 so the client can handle it
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Preserve intended destination for safe internal paths
    if (!pathname.startsWith("/_next") && !pathname.startsWith("/favicon")) {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)).*)",
  ],
};
