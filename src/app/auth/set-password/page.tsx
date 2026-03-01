"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
			setError("Passwort konnte nicht gesetzt werden. Bitte versuche es erneut.");
			setLoading(false);
			return;
		}

		router.push("/female");
		router.refresh();
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Passwort setzen</h1>
					<p className="mt-1 text-sm text-gray-500">
						Bitte wähle ein neues Passwort.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="password">Neues Passwort</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirmPassword">Passwort bestätigen</Label>
						<Input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
						/>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Wird gespeichert..." : "Passwort speichern"}
					</Button>
				</form>
			</div>
		</div>
	);
}
