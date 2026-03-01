"use client";

import { useState } from "react";
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
			<div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
				<div className="sm:mx-auto sm:w-full sm:max-w-md">
					<h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
						E-Mail gesendet
					</h2>
				</div>

				<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
					<div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12 text-center space-y-6">
						<p className="text-sm text-gray-500">
							Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum
							Zurücksetzen des Passworts gesendet.
						</p>
						<a
							href="/login"
							className="text-sm font-semibold text-gray-600 hover:text-gray-900"
						>
							Zurück zum Login
						</a>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
					Passwort vergessen
				</h2>
				<p className="mt-2 text-center text-sm text-gray-500">
					Gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen.
				</p>
			</div>

			<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12">
					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label
								htmlFor="email"
								className="block text-sm/6 font-medium text-gray-900"
							>
								E-Mail
							</label>
							<div className="mt-2">
								<input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
									className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-gray-900 sm:text-sm/6"
								/>
							</div>
						</div>

						{error && (
							<div className="rounded-md bg-red-50 p-3">
								<p className="text-sm text-red-700">{error}</p>
							</div>
						)}

						<div>
							<button
								type="submit"
								disabled={loading}
								className="flex w-full justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:opacity-50"
							>
								{loading ? "Wird gesendet..." : "Link senden"}
							</button>
						</div>
					</form>

					<div className="mt-6 text-center">
						<a
							href="/login"
							className="text-sm font-semibold text-gray-600 hover:text-gray-900"
						>
							Zurück zum Login
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
