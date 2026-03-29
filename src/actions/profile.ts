"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: {
  first_name: string;
  last_name: string;
  birth_date: string;
}) {
  const user = await getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      birth_date: data.birth_date || null,
    })
    .eq("id", user.id);

  if (error) throw error;
  revalidatePath("/", "layout");
}
