import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { getAllMealClaims, getMealSettings } from "@/actions/meals";
import { GastroClient } from "./gastro-client";

export default async function GastroPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "gastro") redirect("/");

  const [claims, settings] = await Promise.all([
    getAllMealClaims("all"),
    getMealSettings(),
  ]);

  return (
    <GastroClient
      initialClaims={claims}
      settings={settings}
      isAdmin={profile.role === "admin"}
    />
  );
}
