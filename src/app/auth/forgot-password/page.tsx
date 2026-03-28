"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");
	const supabase = createClient();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
		});

		if (error) {
			setError("Fehler beim Senden der E-Mail. Bitte versuche es erneut.");
			setLoading(false);
			return;
		}

		setSent(true);
		setLoading(false);
	}

	if (sent) {
		return (
			<div className="flex min-h-full flex-col bg-background">
				<div className="relative overflow-hidden bg-primary px-6 pb-8 pt-12 text-center">
					<div className="absolute -left-10 -top-10 h-40 w-40 rotate-12 bg-golden/20" />
					<div className="absolute -right-6 -bottom-6 h-32 w-32 -rotate-12 bg-sage/20" />
					<div className="relative">
						<div className="mb-4 mx-auto h-1 w-24 bg-golden" />
						<h1 className="font-display text-4xl text-white tracking-wider">E-Mail gesendet</h1>
						<div className="mt-4 mx-auto h-1 w-24 bg-golden" />
					</div>
				</div>

				<div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
					<div className="mx-auto w-full max-w-sm text-center space-y-6">
						<p className="text-sm text-muted-foreground">
							Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum
							Zurücksetzen des Passworts gesendet.
						</p>
						<Link
							href="/login"
							className="text-sm font-semibold text-sage hover:text-primary transition-colors"
						>
							Zurück zum Login
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-full flex-col bg-background">
			<div className="relative overflow-hidden bg-primary px-6 pb-8 pt-12 text-center">
				<div className="absolute -left-10 -top-10 h-40 w-40 rotate-12 bg-golden/20" />
				<div className="absolute -right-6 -bottom-6 h-32 w-32 -rotate-12 bg-sage/20" />
				<div className="absolute right-8 top-6 h-20 w-1.5 bg-golden/30" />
				<div className="relative">
					<div className="mb-4 mx-auto h-1 w-24 bg-golden" />
					<h1 className="font-display text-4xl text-white tracking-wider">Passwort vergessen</h1>
					<div className="mt-4 mx-auto h-1 w-24 bg-golden" />
					<p className="mt-4 text-sm text-white/80 font-sans normal-case tracking-normal">
						Gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen.
					</p>
				</div>
			</div>

			<div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
				<div className="mx-auto w-full max-w-sm">
					<form onSubmit={handleSubmit} className="space-y-5">
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
							{loading ? "Wird gesendet..." : "Link senden"}
						</button>
					</form>

					<div className="mt-6 text-center">
						<Link
							href="/login"
							className="text-sm font-medium text-sage hover:text-primary transition-colors"
						>
							Zurück zum Login
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
