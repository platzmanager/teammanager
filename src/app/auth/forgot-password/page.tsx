"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
			<div className="flex min-h-screen items-center justify-center bg-gray-50">
				<div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
					<div className="text-center space-y-2">
						<h1 className="text-2xl font-bold">E-Mail gesendet</h1>
						<p className="text-sm text-gray-500">
							Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum
							Zurücksetzen des Passworts gesendet.
						</p>
					</div>
					<div className="text-center">
						<a
							href="/login"
							className="text-sm text-gray-500 hover:text-gray-700 underline"
						>
							Zurück zum Login
						</a>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Passwort vergessen</h1>
					<p className="mt-1 text-sm text-gray-500">
						Gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">E-Mail</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Wird gesendet..." : "Link senden"}
					</Button>
				</form>

				<div className="text-center">
					<a
						href="/login"
						className="text-sm text-gray-500 hover:text-gray-700 underline"
					>
						Zurück zum Login
					</a>
				</div>
			</div>
		</div>
	);
}
