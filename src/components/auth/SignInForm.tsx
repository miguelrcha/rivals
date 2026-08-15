"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PixelButton } from "../PixelButton";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    let email = identifier;

    if (!identifier.includes("@")) {
      const { data, error: lookupError } = await supabase.rpc(
        "email_for_username",
        { lookup_username: identifier },
      );

      if (lookupError || !data) {
        setError("We couldn't find an account with that username.");
        setIsLoading(false);
        return;
      }

      email = data as string;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <div className="eyebrow">WELCOME BACK</div>
      <h1 className="auth-card__title">Sign in to rivals</h1>
      <p className="auth-card__subtitle">
        Check the leaderboard, log a run, or lock in your spot for
        Friday&apos;s race.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="identifier">Email or Username</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            placeholder="ash@pallet.town or Red"
            autoComplete="username"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <PixelButton type="submit" variant="solid" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </PixelButton>
      </form>

      <p className="auth-switch">
        New to the crew? <Link href="/auth/sign-up">Create an account</Link>
      </p>
    </div>
  );
}
