"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkExistingAccount, joinTeamAsLoggedInUser, registerViaInvite } from "@/actions/members";
import { createClient } from "@/lib/supabase/client";

interface JoinFormProps {
  token: string;
  teamName: string;
  clubName: string;
  clubSlug: string;
  loggedInEmail: string | null;
}

type Step = "form" | "login-hint" | "register";

export function JoinForm({ token, clubSlug, loggedInEmail }: JoinFormProps) {
  const [step, setStep] = useState<Step>(loggedInEmail ? "form" : "form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // ── Already logged in: just join ──
  if (loggedInEmail) {
    return (
      <div className="space-y-6">
        <p className="text-center text-sm text-muted-foreground">
          Eingeloggt als <span className="font-medium text-foreground">{loggedInEmail}</span>
        </p>

        {success ? (
          <div className="bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Beigetreten! Du wirst weitergeleitet...
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  await joinTeamAsLoggedInUser(token);
                  setSuccess(true);
                  setTimeout(() => router.push(`/${clubSlug}/teams`), 1500);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen");
                } finally {
                  setLoading(false);
                }
              }}
              className="flex w-full justify-center bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Wird beigetreten..." : "Team beitreten"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Step: Login hint (member already has account) ──
  if (step === "login-hint") {
    async function handleLogin(e: React.FormEvent) {
      e.preventDefault();
      setLoading(true);
      setError("");

      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError("Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.");
        setLoading(false);
        return;
      }

      // Now join the team
      try {
        await joinTeamAsLoggedInUser(token);
        setSuccess(true);
        setTimeout(() => router.push(`/${clubSlug}/teams`), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen");
        setLoading(false);
      }
    }

    if (success) {
      return (
        <div className="text-center space-y-3">
          <div className="bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Beigetreten! Du wirst weitergeleitet...
            </p>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="border-l-4 border-golden bg-golden/10 p-4">
          <p className="text-sm text-foreground">
            Du hast bereits ein Konto mit <span className="font-medium">{maskedEmail}</span>.
            Bitte melde dich an, um dem Team beizutreten.
          </p>
        </div>

        <div>
          <label htmlFor="login_email" className="block text-sm font-medium text-gray-900">
            E-Mail
          </label>
          <div className="mt-2">
            <input
              id="login_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login_password" className="block text-sm font-medium text-gray-900">
            Passwort
          </label>
          <div className="mt-2">
            <input
              id="login_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Wird eingeloggt..." : "Anmelden & beitreten"}
        </button>
      </form>
    );
  }

  // ── Step: Name + birth date form (initial) or register form ──
  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Normalize birth_date
      let normalizedDate = birthDate;
      const dotMatch = normalizedDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        normalizedDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
      }

      const masked = await checkExistingAccount(token, firstName, lastName, normalizedDate);
      if (masked) {
        setMaskedEmail(masked);
        setStep("login-hint");
      } else {
        setStep("register");
      }
    } catch {
      setStep("register");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await registerViaInvite(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        email: email.trim(),
        password,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-3">
        <div className="bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Registrierung erfolgreich! Du wirst zum Login weitergeleitet...
          </p>
        </div>
      </div>
    );
  }

  if (step === "register") {
    return (
      <form onSubmit={handleRegister} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="reg_first_name" className="block text-sm font-medium text-gray-900">Vorname</label>
            <div className="mt-2">
              <input
                id="reg_first_name"
                type="text"
                value={firstName}
                disabled
                className="block w-full border-b-2 border-border bg-muted px-3 py-2 text-foreground sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg_last_name" className="block text-sm font-medium text-gray-900">Nachname</label>
            <div className="mt-2">
              <input
                id="reg_last_name"
                type="text"
                value={lastName}
                disabled
                className="block w-full border-b-2 border-border bg-muted px-3 py-2 text-foreground sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="reg_email" className="block text-sm font-medium text-gray-900">
            E-Mail
          </label>
          <div className="mt-2">
            <input
              id="reg_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg_password" className="block text-sm font-medium text-gray-900">
            Passwort
          </label>
          <div className="mt-2">
            <input
              id="reg_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Wird registriert..." : "Registrieren"}
        </button>

        <button
          type="button"
          onClick={() => setStep("form")}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Zurück
        </button>
      </form>
    );
  }

  // ── Initial: Name + birth date ──
  return (
    <form onSubmit={handleNameSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-gray-900">
            Vorname
          </label>
          <div className="mt-2">
            <input
              id="first_name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>
        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-gray-900">
            Nachname
          </label>
          <div className="mt-2">
            <input
              id="last_name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="birth_date" className="block text-sm font-medium text-gray-900">
          Geburtsdatum
        </label>
        <div className="mt-2">
          <input
            id="birth_date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            className="block w-full border-b-2 border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:text-sm transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full justify-center bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? "Wird geprüft..." : "Weiter"}
      </button>
    </form>
  );
}
