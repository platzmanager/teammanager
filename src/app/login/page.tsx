"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
	auth: "Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.",
	"Email link is invalid or has expired":
		"Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
	"Token has expired or is invalid":
		"Der Link ist abgelaufen. Bitte fordere einen neuen an.",
};

function getErrorMessage(error: string): string {
	return ERROR_MESSAGES[error] || error;
}

function LoginForm() {
	const searchParams = useSearchParams();
	const urlError = searchParams.get("error");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState(urlError ? getErrorMessage(urlError) : "");
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const supabase = createClient();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setError("Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.");
			setLoading(false);
			return;
		}

		router.push("/api/club/resolve");
		router.refresh();
	}

	return (
		<div className="flex min-h-full flex-col lg:flex-row">
			{/* Left: brand panel (desktop only) */}
			<div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center relative overflow-hidden">
				<div className="absolute -left-20 -top-20 h-64 w-64 rotate-12 bg-golden/20" />
				<div className="absolute -right-10 -bottom-10 h-48 w-48 -rotate-12 bg-sage/20" />
				<div className="absolute right-12 top-16 h-32 w-2 bg-golden/30" />
				<div className="absolute left-16 bottom-24 h-2 w-32 bg-verdigris/30" />
				<div className="relative text-center px-12">
					<div className="mb-6 mx-auto h-1.5 w-32 bg-golden" />
					<h1 className="font-display text-8xl text-white tracking-wider">Matchday.</h1>
					<div className="mt-6 mx-auto h-1.5 w-32 bg-golden" />
					<p className="mt-8 text-lg text-white/90 font-sans normal-case tracking-normal">
						Dein Tennis. Dein Team. Dein Spieltag.
					</p>
					<div className="mt-8 flex items-center justify-center gap-3">
						<div className="h-2.5 w-2.5 bg-golden" />
						<div className="h-2.5 w-2.5 bg-verdigris" />
						<div className="h-2.5 w-2.5 bg-sage" />
						<div className="h-2.5 w-2.5 bg-mint" />
					</div>
				</div>
			</div>

			{/* Mobile brand header */}
			<div className="relative overflow-hidden bg-primary px-6 pb-8 pt-12 text-center lg:hidden">
				<div className="absolute -left-10 -top-10 h-40 w-40 rotate-12 bg-golden/20" />
				<div className="absolute -right-6 -bottom-6 h-32 w-32 -rotate-12 bg-sage/20" />
				<div className="absolute right-8 top-6 h-20 w-1.5 bg-golden/30" />
				<div className="relative">
					<div className="mb-4 mx-auto h-1 w-24 bg-golden" />
					<h1 className="font-display text-5xl text-white tracking-wider">Matchday.</h1>
					<div className="mt-4 mx-auto h-1 w-24 bg-golden" />
					<p className="mt-4 text-sm text-white/80 font-sans normal-case tracking-normal">
						Dein Tennis. Dein Team. Dein Spieltag.
					</p>
					<div className="mt-4 flex items-center justify-center gap-2">
						<div className="h-2 w-2 bg-golden" />
						<div className="h-2 w-2 bg-verdigris" />
						<div className="h-2 w-2 bg-sage" />
						<div className="h-2 w-2 bg-mint" />
					</div>
				</div>
			</div>

			{/* Login form */}
			<div className="flex flex-1 flex-col justify-center bg-background px-6 py-10 sm:px-12 lg:w-1/2">
				<div className="mx-auto w-full max-w-sm">
					<div className="flex items-center gap-3">
						<div className="h-8 w-1.5 bg-primary" />
						<h2 className="text-3xl">Anmelden</h2>
					</div>
					<p className="mt-2 text-sm text-muted-foreground font-sans normal-case">
						Melde dich mit deinem Account an
					</p>

					<form onSubmit={handleSubmit} className="mt-8 space-y-5">
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-foreground">
								E-Mail
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
								className="mt-1.5 block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-foreground">
								Passwort
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
								className="mt-1.5 block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
							/>
						</div>

						<div className="flex items-center justify-end">
							<Link
								href="/auth/forgot-password"
								className="text-sm font-medium text-sage hover:text-primary transition-colors"
							>
								Passwort vergessen?
							</Link>
						</div>

						{error && (
							<div className="border-l-4 border-destructive bg-destructive/10 p-3">
								<p className="text-sm text-destructive">{error}</p>
							</div>
						)}

						<button
							type="submit"
							disabled={loading}
							className="flex w-full justify-center bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
						>
							{loading ? "Wird eingeloggt..." : "Einloggen"}
						</button>

						<div className="flex items-center gap-2 pt-2">
							<div className="h-px flex-1 bg-golden/30" />
							<span className="text-xs text-muted-foreground font-sans normal-case">matchday.tennis</span>
							<div className="h-px flex-1 bg-golden/30" />
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
