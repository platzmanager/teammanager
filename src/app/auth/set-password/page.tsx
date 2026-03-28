"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const supabase = createClient();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		if (password !== confirmPassword) {
			setError("Passwörter stimmen nicht überein.");
			return;
		}

		if (password.length < 8) {
			setError("Passwort muss mindestens 8 Zeichen lang sein.");
			return;
		}

		setLoading(true);

		const { error } = await supabase.auth.updateUser({ password });

		if (error) {
			setError(
				"Passwort konnte nicht gesetzt werden. Bitte versuche es erneut.",
			);
			setLoading(false);
			return;
		}

		router.push("/");
		router.refresh();
	}

	return (
		<div className="flex min-h-full flex-col bg-background">
			<div className="relative overflow-hidden bg-primary px-6 pb-8 pt-12 text-center">
				<div className="absolute -left-10 -top-10 h-40 w-40 rotate-12 bg-golden/20" />
				<div className="absolute -right-6 -bottom-6 h-32 w-32 -rotate-12 bg-sage/20" />
				<div className="absolute right-8 top-6 h-20 w-1.5 bg-golden/30" />
				<div className="relative">
					<div className="mb-4 mx-auto h-1 w-24 bg-golden" />
					<h1 className="font-display text-4xl text-white tracking-wider">Passwort setzen</h1>
					<div className="mt-4 mx-auto h-1 w-24 bg-golden" />
					<p className="mt-4 text-sm text-white/80 font-sans normal-case tracking-normal">
						Bitte wähle ein neues Passwort.
					</p>
				</div>
			</div>

			<div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
				<div className="mx-auto w-full max-w-sm">
					<form onSubmit={handleSubmit} className="space-y-5">
						<div>
							<label htmlFor="password" className="block text-sm font-medium text-foreground">
								Neues Passwort
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="new-password"
								className="mt-1.5 block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
							/>
						</div>

						<div>
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
								Passwort bestätigen
							</label>
							<input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								autoComplete="new-password"
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
							{loading ? "Wird gespeichert..." : "Passwort speichern"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
