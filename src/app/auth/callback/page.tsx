"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function CallbackHandler() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const supabase = createClient();

	useEffect(() => {
		async function handleCallback() {
			const code = searchParams.get("code");
			const type = searchParams.get("type");
			const next = searchParams.get("next") ?? "/female";
			const errorParam = searchParams.get("error");
			const errorDescription = searchParams.get("error_description");

			// Supabase redirects with error params for expired/invalid links
			if (errorParam) {
				const message = errorDescription || errorParam;
				router.replace(`/login?error=${encodeURIComponent(message)}`);
				return;
			}

			// PKCE flow: exchange code for session
			if (code) {
				const { error } = await supabase.auth.exchangeCodeForSession(code);
				if (error) {
					router.replace("/login?error=auth");
					return;
				}
				if (type === "invite" || type === "recovery") {
					router.replace("/auth/set-password");
					return;
				}
				router.replace(next);
				return;
			}

			// Implicit flow: hash fragments are handled by supabase-js automatically.
			// Check if we have a session from the hash.
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (session) {
				// Detect type from hash fragment via onAuthStateChange event or URL hash
				const hash = window.location.hash;
				if (hash.includes("type=invite") || hash.includes("type=recovery")) {
					router.replace("/auth/set-password");
					return;
				}
				router.replace(next);
				return;
			}

			// No code and no session — something went wrong
			router.replace("/login?error=auth");
		}

		handleCallback();
	}, [router, searchParams, supabase]);

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
