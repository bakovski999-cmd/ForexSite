import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const snapshot = await loadDashboardSnapshot();

  return (
    <AppShell
      session={session}
      staleFlags={snapshot.staleFlags}
      generatedAt={snapshot.generatedAt}
    >
      {children}
    </AppShell>
  );
}
