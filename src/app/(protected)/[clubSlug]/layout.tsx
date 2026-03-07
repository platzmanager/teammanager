import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClubId } from "@/lib/club";

export default async function ClubSlugLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ clubSlug: string }>;
}) {
	const { clubSlug } = await params;
	const currentClubId = await getCurrentClubId();

	// Look up club by slug
	const supabase = await createClient();
	const { data: club } = await supabase
		.from("clubs")
		.select("id")
		.eq("slug", clubSlug)
		.single();

	if (!club) {
		redirect("/api/club/resolve");
	}

	// Sync cookie if URL slug doesn't match current cookie
	if (club.id !== currentClubId) {
		// Verify user has access to this club
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) redirect("/login");

		const { data: membership } = await supabase
			.from("user_clubs")
			.select("club_id")
			.eq("user_id", user.id)
			.eq("club_id", club.id)
			.single();

		if (!membership) {
			redirect("/api/club/resolve");
		}

		const cookieStore = await cookies();
		cookieStore.set("current_club_id", club.id, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 365,
		});
	}

	return <>{children}</>;
}
