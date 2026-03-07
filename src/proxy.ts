import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    // Copy auth cookies from supabaseResponse so token refreshes are not lost
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  };

  if (pathname.startsWith("/join/")) {
    return supabaseResponse;
  }

  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    if (user && pathname !== "/auth/set-password") {
      return redirectTo("/api/club/resolve");
    }
    return supabaseResponse;
  }

  if (!user) {
    return redirectTo("/login");
  }

  const exemptPaths = ["/club-select", "/api/club/resolve", "/api/logout"];
  const isExempt = exemptPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isExempt && !request.cookies.get("current_club_id")?.value) {
    return redirectTo("/api/club/resolve");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
