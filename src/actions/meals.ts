"use server";

import { requireRole } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { revalidatePath } from "next/cache";
import type { MealClaim, MealSettings } from "@/lib/types";

// ─── MEAL CLAIMS ─────────────────────────────────────────────────

/** Captain: list home matches for my teams, with existing claim if any */
export async function getMyMealMatches() {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    let teamIds: string[] = [];

    if (profile.role === "admin") {
      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("club_id", clubId);
      teamIds = (teams ?? []).map((t) => t.id);
    } else {
      teamIds = profile.captainTeamIds ?? [];
    }

    if (teamIds.length === 0) return [];

    const { data, error } = await supabase
      .from("matches")
      .select(`
        id, match_date, match_time, home_team, away_team, is_home, location,
        team:teams(id, name, gender, age_class, slug),
        meal_claims(id, meal_count, amount_per_meal, notes, status, confirmed_at, settled_at)
      `)
      .eq("club_id", clubId)
      .eq("is_home", true)
      .in("team_id", teamIds)
      .order("match_date", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });
}

/** Gastro / Admin: list all meal claims with match + captain info */
export async function getAllMealClaims(filter?: "submitted" | "confirmed" | "settled" | "all") {
  const profile = await requireRole();
  if (profile.role !== "admin" && profile.role !== "gastro") {
    throw new Error("Keine Berechtigung");
  }

  return withClubContext(async (supabase, clubId) => {
    let query = supabase
      .from("meal_claims")
      .select(`
        *,
        match:matches(id, match_date, match_time, home_team, away_team, location,
          team:teams(id, name, gender, age_class)
        ),
        captain:user_profiles!captain_id(first_name, last_name)
      `)
      .eq("club_id", clubId);

    if (filter && filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MealClaim[];
  });
}

/** Captain: upsert a meal claim for a home match */
export async function upsertMealClaim(
  matchId: string,
  mealCount: number,
  notes: string
) {
  const profile = await requireRole();

  return withClubContext(async (supabase, clubId) => {
    // Load settings to get current amount_per_meal
    const { data: settings } = await supabase
      .from("meal_settings")
      .select("amount_per_meal")
      .eq("club_id", clubId)
      .maybeSingle();
    const amountPerMeal = settings?.amount_per_meal ?? 10;

    // Check if claim already exists
    const { data: existing } = await supabase
      .from("meal_claims")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();

    if (existing && existing.status !== "submitted") {
      throw new Error("Diese Meldung wurde bereits bestätigt und kann nicht mehr geändert werden.");
    }

    if (existing) {
      // Update
      const { error } = await supabase
        .from("meal_claims")
        .update({ meal_count: mealCount, notes: notes || null, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from("meal_claims")
        .insert({
          club_id: clubId,
          match_id: matchId,
          captain_id: profile.id,
          meal_count: mealCount,
          amount_per_meal: amountPerMeal,
          notes: notes || null,
        });
      if (error) throw error;
    }

    revalidatePath("/", "layout");
  });
}

/** Gastro / Admin: confirm one or more claims */
export async function confirmMealClaims(claimIds: string[]) {
  const profile = await requireRole();
  if (profile.role !== "admin" && profile.role !== "gastro") {
    throw new Error("Keine Berechtigung");
  }
  if (claimIds.length === 0) return;

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase
      .from("meal_claims")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .in("id", claimIds)
      .eq("club_id", clubId)
      .eq("status", "submitted");

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

/** Admin: mark confirmed claims as settled (after PDF export) */
export async function settleMealClaims(claimIds: string[]) {
  await requireRole(); // admin check in RLS

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase
      .from("meal_claims")
      .update({ status: "settled", settled_at: new Date().toISOString() })
      .in("id", claimIds)
      .eq("club_id", clubId)
      .eq("status", "confirmed");

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

// ─── MEAL SETTINGS ───────────────────────────────────────────────

export async function getMealSettings(): Promise<MealSettings | null> {
  return withClubContext(async (supabase, clubId) => {
    const { data } = await supabase
      .from("meal_settings")
      .select("*")
      .eq("club_id", clubId)
      .maybeSingle();
    return data as MealSettings | null;
  });
}

export async function upsertMealSettings(settings: {
  amount_per_meal: number;
  billing_interval: "monthly" | "quarterly" | "yearly" | "seasonal";
  finance_email?: string;
  season_start?: string;
  season_end?: string;
}) {
  const profile = await requireRole();
  if (profile.role !== "admin") throw new Error("Admin-Berechtigung erforderlich");

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase
      .from("meal_settings")
      .upsert({
        club_id: clubId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "club_id" });

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

// ─── PDF REPORT DATA ─────────────────────────────────────────────

export async function getMealClaimsForReport(from: string, to: string) {
  const profile = await requireRole();
  if (profile.role !== "admin" && profile.role !== "gastro") {
    throw new Error("Keine Berechtigung");
  }

  return withClubContext(async (supabase, clubId) => {
    const { data: club } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .single();

    const { data: settings } = await supabase
      .from("meal_settings")
      .select("*")
      .eq("club_id", clubId)
      .maybeSingle();

    const { data: claims, error } = await supabase
      .from("meal_claims")
      .select(`
        *,
        match:matches(id, match_date, match_time, home_team, away_team,
          team:teams(name, gender, age_class)
        ),
        captain:user_profiles!captain_id(first_name, last_name)
      `)
      .eq("club_id", clubId)
      .in("status", ["confirmed", "settled"])
      .gte("created_at", new Date(from).toISOString())
      .lte("created_at", new Date(to + "T23:59:59").toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    return {
      clubName: club?.name ?? "TC Thalkirchen München",
      settings: settings as MealSettings | null,
      claims: (claims ?? []) as MealClaim[],
    };
  });
}
