import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const baseUrl = request.nextUrl.origin;

  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const { data: memberships } = await supabase
    .from("user_clubs")
    .select("club_id")
    .eq("user_id", user.id);

  const clubs = memberships ?? [];

  if (clubs.length === 1) {
    const response = NextResponse.redirect(new URL("/female", baseUrl));
    response.cookies.set("current_club_id", clubs[0].club_id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  // Multiple or zero clubs — show selection page
  return NextResponse.redirect(new URL("/club-select", baseUrl));
}
