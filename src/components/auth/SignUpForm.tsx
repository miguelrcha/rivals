"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { PixelButton } from "../PixelButton";
import { createClient } from "@/lib/supabase/client";

const NATIONALITIES = [
  { flag: "🇧🇷", label: "Brazil" },
  { flag: "🇺🇸", label: "United States" },
  { flag: "🇬🇧", label: "United Kingdom" },
  { flag: "🇵🇹", label: "Portugal" },
  { flag: "🇯🇵", label: "Japan" },
  { flag: "🇨🇦", label: "Canada" },
  { flag: "🇦🇺", label: "Australia" },
  { flag: "🇩🇪", label: "Germany" },
];

export function SignUpForm() {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (
      passwordRef.current &&
      confirmPasswordRef.current &&
      passwordRef.current.value !== confirmPasswordRef.current.value
    ) {
      confirmPasswordRef.current.setCustomValidity("Passwords don't match.");
      confirmPasswordRef.current.reportValidity();
      return;
    }
    confirmPasswordRef.current?.setCustomValidity("");

    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const gender = String(formData.get("gender") ?? "");
    const flag = String(formData.get("flag") ?? "");
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, gender, flag } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="auth-card auth-card--loading">
        <div className="pixel-loader">
          <div className="pixel-loader__ball" />
        </div>
        <p className="pixel-loader__label">Creating your account...</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="eyebrow">JOIN THE CREW</div>
      <h1 className="auth-card__title">Create your rivals account</h1>
      <p className="auth-card__subtitle">
        Register your trainer name, claim a spot in the league, and start
        logging runs.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Red"
            autoComplete="username"
            required
          />
        </div>

        <div className="auth-field-row">
          <div className="auth-field">
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" defaultValue="" required>
              <option value="" disabled>
                Select one
              </option>
              <option value="male">Homem</option>
              <option value="female">Mulher</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="flag">Nationality</label>
            <select id="flag" name="flag" defaultValue="" required>
              <option value="" disabled>
                Select one
              </option>
              {NATIONALITIES.map((nationality) => (
                <option key={nationality.label} value={nationality.flag}>
                  {nationality.flag} {nationality.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="ash@pallet.town"
            autoComplete="email"
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
            autoComplete="new-password"
            ref={passwordRef}
            onChange={() => confirmPasswordRef.current?.setCustomValidity("")}
            required
            minLength={6}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            ref={confirmPasswordRef}
            onChange={() => confirmPasswordRef.current?.setCustomValidity("")}
            required
            minLength={6}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <PixelButton type="submit" variant="solid">
          Create account
        </PixelButton>
      </form>

      <p className="auth-switch">
        Already racing with us? <Link href="/auth/sign-in">Sign in</Link>
      </p>
    </div>
  );
}
