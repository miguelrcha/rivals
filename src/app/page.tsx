import type { Metadata } from "next";
import { AppShell } from "@/components/dashboard/AppShell";
import { SupporterBanner } from "@/components/dashboard/SupporterBanner";
import { SiteSearch } from "@/components/dashboard/SiteSearch";
import { LatestRuns } from "@/components/dashboard/LatestRuns";
import { CommunityNews } from "@/components/dashboard/CommunityNews";

export const metadata: Metadata = {
  title: "Rivals",
  description: "Your rivals dashboard.",
};

export default function HomePage() {
  return (
    <AppShell>
      <SupporterBanner />
      <SiteSearch />

      <div className="dashboard-columns">
        <LatestRuns />
        <CommunityNews />
      </div>
    </AppShell>
  );
}
