import { redirect } from "next/navigation";
import { Gender } from "@/lib/types";
import { getUserProfile, canAccessGender, getUserAgeClasses, getDefaultPath } from "@/lib/auth";
import { getLastAgeClass } from "@/lib/club";

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

  const allowed = getUserAgeClasses(profile, gender as Gender);
  const last = await getLastAgeClass(gender);
  const target = last && allowed.includes(last as import("@/lib/types").AgeClass) ? last : (allowed[0] ?? "all");
  redirect(`/${clubSlug}/players/${gender}/${target}`);
}
