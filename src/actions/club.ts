"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Club } from "@/lib/types";

export async function getUserClubs(): Promise<Club[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_clubs")
    .select("club:clubs(*)")
    .eq("user_id", user.id);

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => row.club as Club);
}

export async function switchClub(clubId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  // Validate membership
  const { data } = await supabase
    .from("user_clubs")
    .select("club_id")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .single();

  if (!data) throw new Error("Kein Zugriff auf diesen Club");

  const cookieStore = await cookies();
  cookieStore.set("current_club_id", clubId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/female");
}
