import { redirect } from "next/navigation";
import { GenderNav } from "@/components/gender-nav";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth";
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

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
					<h1 className="text-lg font-bold">TC Thalkirchen</h1>
					<div className="flex items-center gap-4">
						<GenderNav />
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
						<form action="/api/logout" method="POST">
							<button
								type="submit"
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								Abmelden
							</button>
						</form>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
		</div>
	);
}
