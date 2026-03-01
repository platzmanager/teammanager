"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import logo from "@/assets/logo/matchday-slogan-green.svg";

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
		<div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<Image src={logo} alt="Matchday.tennis" className="mx-auto mt-6 h-10 w-auto" priority />
				<h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
					Passwort setzen
				</h2>
				<p className="mt-2 text-center text-sm text-gray-500">
					Bitte wähle ein neues Passwort.
				</p>
			</div>

			<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
				<div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12">
					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label
								htmlFor="password"
								className="block text-sm/6 font-medium text-gray-900"
							>
								Neues Passwort
							</label>
							<div className="mt-2">
								<input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									autoComplete="new-password"
									className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-gray-900 sm:text-sm/6"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm/6 font-medium text-gray-900"
							>
								Passwort bestätigen
							</label>
							<div className="mt-2">
								<input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									required
									autoComplete="new-password"
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
								{loading ? "Wird gespeichert..." : "Passwort speichern"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
