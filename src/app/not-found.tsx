import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found / Rivals",
};

export default function NotFound() {
  return (
    <div className="auth-shell">
      <header className="wrap auth-shell__header">
        <Link href="/" className="logo" aria-label="rivals home">
          rivals
        </Link>
      </header>

      <main className="auth-shell__main">
        <div className="auth-card not-found-card">
          <div className="eyebrow">404</div>
          <h1 className="auth-card__title">This route doesn&apos;t exist.</h1>
          <p className="auth-card__subtitle">
            The link you followed doesn&apos;t lead anywhere — the run,
            challenge, or page might&apos;ve been moved, renamed, or never
            existed.
          </p>

          <Image
            src="/errors/404-signal-lost.gif"
            alt="Retro static screen reading 404, signal lost"
            width={480}
            height={320}
            unoptimized
            className="not-found-card__gif"
          />

          <Link
            href="/"
            className="pixel-btn pixel-btn--solid not-found-card__home"
          >
            ← Back to rivals
          </Link>
        </div>
      </main>
    </div>
  );
}
