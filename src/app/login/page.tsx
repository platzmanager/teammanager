"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
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

		router.push("/female");
		router.refresh();
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
				<div className="text-center">
					<h1 className="text-2xl font-bold">TC Thalkirchen</h1>
					<p className="text-sm text-muted-foreground">
						Meldelisten-Verwaltung
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
					<div className="space-y-2">
						<Label htmlFor="password">Passwort</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Wird eingeloggt..." : "Einloggen"}
					</Button>
				</form>
			</div>
		</div>
	);
}
