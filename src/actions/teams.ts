"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Gender, AgeClass } from "@/lib/types";

export async function getTeams() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("gender")
    .order("age_class");

  if (error) throw error;
  return data;
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("teams").insert({
    name: formData.get("name") as string,
    gender: formData.get("gender") as Gender,
    age_class: formData.get("age_class") as AgeClass,
  });

  if (error) throw error;
  revalidatePath("/admin/teams");
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
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
}

export async function deleteTeam(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/teams");
}
