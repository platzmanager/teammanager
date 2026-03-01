import { redirect } from "next/navigation";
import { getUserProfile, getDefaultPath } from "@/lib/auth";

export default async function Home() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(getDefaultPath(profile));
}
