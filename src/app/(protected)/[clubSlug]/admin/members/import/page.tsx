import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { MemberImport } from "@/components/import/member-import";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function MemberImportPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "admin") redirect("/login");

  const { clubSlug } = await params;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${clubSlug}/admin/members`}
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="mr-1 -ml-1 h-5 w-5 shrink-0" />
          Mitglieder
        </Link>
        <h2 className="mt-2 text-2xl font-bold">Mitglieder importieren</h2>
      </div>
      <MemberImport />
    </div>
  );
}
