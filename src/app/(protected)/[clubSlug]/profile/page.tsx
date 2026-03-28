import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl/7 font-bold sm:truncate sm:text-3xl sm:tracking-tight">Profil</h2>
      <ProfileForm
        email={user.email ?? ""}
        firstName={profile.first_name ?? ""}
        lastName={profile.last_name ?? ""}
        birthDate={profile.birth_date ?? ""}
      />
    </div>
  );
}
