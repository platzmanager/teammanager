import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  const { data: memberships } = await supabase
    .from("user_clubs")
    .select("club_id")
    .eq("user_id", user.id);

  const clubs = memberships ?? [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
