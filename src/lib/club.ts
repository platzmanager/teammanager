import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

const COOKIE_NAME = "current_club_id";

export async function getCurrentClubId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function requireClubId(): Promise<string> {
  const clubId = await getCurrentClubId();
  if (!clubId) throw new Error("Kein Club ausgewählt");
  return clubId;
}

export async function withClubContext<T>(
  fn: (supabase: SupabaseClient, clubId: string) => Promise<T>
): Promise<T> {
  const clubId = await requireClubId();
  const supabase = await createClient();
  return fn(supabase, clubId);
}

export async function getLastAgeClass(gender: string): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(`last_age_class_${gender}`)?.value ?? null;
}

export async function setLastAgeClass(gender: string, ageClass: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(`last_age_class_${gender}`, ageClass, { maxAge: 60 * 60 * 24 * 365 });
}

export async function getClubSlug(): Promise<string> {
  const clubId = await requireClubId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("slug")
    .eq("id", clubId)
    .single();
  if (error || !data) throw new Error("Club nicht gefunden");
  return data.slug;
}
