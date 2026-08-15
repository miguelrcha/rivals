import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="wrap auth-shell__header">
        <Link href="/" className="logo" aria-label="rivals home">
          rivals
        </Link>
      </header>
      <main className="auth-shell__main">{children}</main>
    </div>
  );
}
