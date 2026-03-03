import { redirect } from "next/navigation";

export default async function ClubRootPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  redirect(`/${clubSlug}/teams`);
}
