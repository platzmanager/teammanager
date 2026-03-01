import { redirect } from "next/navigation";
import { GenderNav } from "@/components/gender-nav";
import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile, getUserGenders } from "@/lib/auth";
import { getUserClubs } from "@/actions/club";
import { getCurrentClubId } from "@/lib/club";
import Link from "next/link";

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const profile = await getUserProfile();
	const isAdmin = profile?.role === "admin";
	const allowedGenders = profile ? getUserGenders(profile) : [];

	const clubs = await getUserClubs();
	const currentClubId = await getCurrentClubId();
	const currentClub = clubs.find((c) => c.id === currentClubId);

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
					<h1 className="text-lg font-bold">{currentClub?.name ?? "Club"}</h1>
					<div className="flex items-center gap-4">
						<GenderNav allowedGenders={allowedGenders} />
						{isAdmin && (
							<nav className="flex gap-1">
								<Link
									href="/admin/teams"
									className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
								>
									Teams
								</Link>
								<Link
									href="/admin/import"
									className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
								>
									Import
								</Link>
							</nav>
						)}
						<UserMenu
							email={user.email ?? ""}
							role={profile?.role ?? "player"}
							teams={profile?.teams ?? []}
							hasMultipleClubs={clubs.length > 1}
						/>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
		</div>
	);
}
