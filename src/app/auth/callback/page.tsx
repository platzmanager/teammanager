"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function CallbackHandler() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const supabase = createClient();
	const next = searchParams.get("next") ?? "/api/club/resolve";

	useEffect(() => {
		const code = searchParams.get("code");
		const tokenHash = searchParams.get("token_hash");
		const type = searchParams.get("type");
		const errorParam = searchParams.get("error");
		const errorDescription = searchParams.get("error_description");

		if (errorParam) {
			const message = errorDescription || errorParam;
			router.replace(`/login?error=${encodeURIComponent(message)}`);
			return;
		}

		// PKCE flow: exchange code for session (used by password reset, magic links)
		if (code) {
			supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
				if (error) {
					router.replace("/login?error=auth");
					return;
				}
				if (type === "invite" || type === "recovery") {
					router.replace("/auth/set-password");
				} else {
					router.replace(next);
				}
			});
			return;
		}

		// Token hash flow: email links with token_hash (invite, recovery)
		if (tokenHash && type) {
			supabase.auth
				.verifyOtp({ token_hash: tokenHash, type: type as "invite" | "recovery" | "email" })
				.then(({ error }) => {
					if (error) {
						router.replace(
							`/login?error=${encodeURIComponent(error.message)}`,
						);
						return;
					}
					if (type === "invite" || type === "recovery") {
						router.replace("/auth/set-password");
					} else {
						router.replace(next);
					}
				});
			return;
		}

		// No code or token_hash — nothing to process
		router.replace("/login");
	}, [router, next, searchParams, supabase]);

	return (
		<div className="flex min-h-full items-center justify-center">
			<p className="text-sm text-gray-500">Wird authentifiziert...</p>
		</div>
	);
}

export default function AuthCallbackPage() {
	return (
		<Suspense>
			<CallbackHandler />
		</Suspense>
	);
}
