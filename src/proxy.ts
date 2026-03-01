import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow login page and auth callback without auth
  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    if (user) {
      // Already logged in, redirect to app
      const url = request.nextUrl.clone();
      url.pathname = "/female";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Protect all other routes
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Exempt paths that don't need club context
  const exemptPaths = ["/club-select", "/api/club/resolve", "/api/logout"];
  const isExempt = exemptPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isExempt && !request.cookies.get("current_club_id")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/club/resolve";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
