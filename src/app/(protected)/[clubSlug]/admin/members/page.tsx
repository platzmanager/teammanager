import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { getMembers, getUnmatchedMembers, getUnlinkedUsers } from "@/actions/members";
import { MembersClient } from "./members-client";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "admin") redirect("/login");

  const { clubSlug } = await params;

  const [members, unmatched, unlinkedUsers] = await Promise.all([
    getMembers(),
    getUnmatchedMembers(),
    getUnlinkedUsers(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mitglieder</h2>
      <MembersClient
        members={members}
        unmatchedCount={unmatched.length}
        unlinkedUsers={unlinkedUsers}
        clubSlug={clubSlug}
      />
    </div>
  );
}
