"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Gender, AgeClass } from "@/lib/types";
import { withClubContext } from "@/lib/club";

export async function getTeams() {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("club_id", clubId)
      .order("gender")
      .order("age_class");

    if (error) throw error;
    return data;
  });
}

export async function createTeam(formData: FormData) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase.from("teams").insert({
      name: formData.get("name") as string,
      gender: formData.get("gender") as Gender,
      age_class: formData.get("age_class") as AgeClass,
      club_id: clubId,
    });

    if (error) throw error;
    revalidatePath("/admin/teams");
  });
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();

  return withClubContext(async (supabase) => {
    const id = formData.get("id") as string;

    const { error } = await supabase
      .from("teams")
      .update({
        name: formData.get("name") as string,
        gender: formData.get("gender") as Gender,
        age_class: formData.get("age_class") as AgeClass,
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/admin/teams");
  });
}

export async function deleteTeam(id: string) {
  await requireAdmin();

  return withClubContext(async (supabase) => {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/teams");
  });
}
