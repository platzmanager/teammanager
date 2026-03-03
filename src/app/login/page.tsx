"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import logo from "@/assets/logo/matchday-slogan-green.svg";

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
		<div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<Image src={logo} alt="Matchday.tennis" className="mx-auto mt-6 h-10 w-auto" priority />
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

						<div>
							<label
								htmlFor="password"
								className="block text-sm/6 font-medium text-gray-900"
							>
								Passwort
							</label>
							<div className="mt-2">
								<input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									autoComplete="current-password"
									className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-gray-900 sm:text-sm/6"
								/>
							</div>
						</div>

						<div className="flex items-center justify-end">
							<div className="text-sm/6">
								<Link
									href="/auth/forgot-password"
									className="font-semibold text-gray-600 hover:text-gray-900"
								>
									Passwort vergessen?
								</Link>
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
								{loading ? "Wird eingeloggt..." : "Einloggen"}
							</button>
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
