import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
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
	const genders = profile ? getUserGenders(profile) : [];

	const clubs = await getUserClubs();
	const currentClubId = await getCurrentClubId();
	const currentClub = clubs.find((c) => c.id === currentClubId);
	if (!currentClub) {
		redirect("/api/club/resolve");
	}
	const clubSlug = currentClub.slug;

	return (
		<div className="min-h-screen bg-background">
			<header className="bg-primary text-white relative overflow-hidden">
				<div className="hidden md:block absolute right-0 top-0 h-full w-48 bg-golden/10 -skew-x-12 translate-x-16" />
				<div className="hidden md:block absolute right-0 top-0 h-full w-24 bg-sage/10 -skew-x-12 translate-x-32" />
				<div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:py-4">
					<div className="flex items-center gap-3">
						<div className="h-6 w-1.5 bg-golden" />
						<h1 className="font-display text-xl md:text-2xl tracking-wider">{currentClub?.name ?? "Club"}</h1>
					</div>
					<UserMenu
						email={user.email ?? ""}
						firstName={profile?.first_name}
						lastName={profile?.last_name}
						role={profile?.role ?? "player"}
						teams={profile?.teams ?? []}
						hasMultipleClubs={clubs.length > 1}
						clubSlug={clubSlug}
					/>
				</div>
			</header>
			{/* Desktop nav */}
			<nav className="hidden md:block border-b border-golden/20 bg-white">
				<div className="mx-auto flex max-w-4xl gap-0 px-4">
					<Link
						href={`/${clubSlug}/teams`}
						className="border-b-2 border-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
					>
						Teams
					</Link>
					{genders.length > 0 && (
						<Link
							href={`/${clubSlug}/players/${genders[0]}/overview`}
							className="border-b-2 border-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
						>
							Meldeliste
						</Link>
					)}
					<Link
						href={`/${clubSlug}/events`}
						className="border-b-2 border-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
					>
						Termine
					</Link>
					{isAdmin && (
						<>
							<Link
								href={`/${clubSlug}/admin/members`}
								className="border-b-2 border-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
							>
								Mitglieder
							</Link>
							<Link
								href={`/${clubSlug}/admin/import`}
								className="border-b-2 border-transparent px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
							>
								Import
							</Link>
						</>
					)}
				</div>
			</nav>
			<main className="mx-auto max-w-4xl px-4 py-6 pb-20 md:pb-6">{children}</main>
			{/* Mobile bottom tab bar */}
			<MobileNav
				clubSlug={clubSlug}
				isAdmin={isAdmin}
				hasPlayers={genders.length > 0}
				firstGender={genders[0] ?? "male"}
			/>
		</div>
	);
}
