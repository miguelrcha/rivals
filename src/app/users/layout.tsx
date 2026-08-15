import { AppShell } from "@/components/dashboard/AppShell";

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
