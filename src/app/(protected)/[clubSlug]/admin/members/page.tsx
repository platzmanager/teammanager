import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { getMembers, getUnmatchedMembers } from "@/actions/members";
import { MembersClient } from "./members-client";

export default async function MembersPage() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "admin") redirect("/login");

  const [members, unmatched] = await Promise.all([
    getMembers(),
    getUnmatchedMembers(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mitglieder</h2>
      <MembersClient members={members} unmatchedCount={unmatched.length} />
    </div>
  );
}
