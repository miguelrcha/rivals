import { AppShell } from "@/components/dashboard/AppShell";

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
