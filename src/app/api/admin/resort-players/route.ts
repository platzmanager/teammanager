import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { requireClubId } from "@/lib/club";
import { Gender } from "@/lib/types";

export async function POST() {
  if (process.env.ENABLE_RESORT_PLAYERS !== "true") {
    return NextResponse.json({ error: "This endpoint is disabled." }, { status: 403 });
  }

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin-Berechtigung erforderlich" }, { status: 403 });
  }

  const clubId = await requireClubId();
  const supabase = await createClient();

  const results: Record<string, number> = {};

  for (const gender of ["male", "female"] as Gender[]) {
    const { data: players, error } = await supabase
      .from("players")
      .select("uuid, skill_level, last_name, first_name")
      .eq("gender", gender)
      .eq("club_id", clubId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!players || players.length === 0) {
      results[gender] = 0;
      continue;
    }

    const sorted = [...players].sort((a, b) => {
      const aLk = a.skill_level ?? 99;
      const bLk = b.skill_level ?? 99;
      if (aLk !== bLk) return aLk - bLk;
      const lastCmp = a.last_name.localeCompare(b.last_name, "de");
      if (lastCmp !== 0) return lastCmp;
      return a.first_name.localeCompare(b.first_name, "de");
    });

    const updates = sorted.map((p, i) =>
      supabase
        .from("players")
        .update({ sort_position: (i + 1) * 100 })
        .eq("uuid", p.uuid)
    );

    await Promise.all(updates);
    results[gender] = sorted.length;
  }

  return NextResponse.json({
    success: true,
    message: "Players resorted by skill_level, then last_name, first_name. Players without LK placed at the end.",
    results,
  });
}
