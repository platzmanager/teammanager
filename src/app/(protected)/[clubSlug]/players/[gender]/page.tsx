import { redirect } from "next/navigation";
import { Gender } from "@/lib/types";
import { getUserProfile, canAccessGender, getDefaultPath } from "@/lib/auth";

const validGenders: Gender[] = ["female", "male"];

export default async function GenderPage({
  params,
}: {
  params: Promise<{ clubSlug: string; gender: string }>;
}) {
  const { clubSlug, gender } = await params;
  const profile = await getUserProfile();

  if (!profile) redirect("/login");

  if (!validGenders.includes(gender as Gender) || !canAccessGender(profile, gender as Gender)) {
    redirect(getDefaultPath(profile, clubSlug));
  }

  redirect(`/${clubSlug}/players/${gender}/all`);
}
