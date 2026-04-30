"use client";

import { BarChart3, CalendarDays, Newspaper, Radar, TrendingUp, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { RefreshButton } from "@/components/refresh-button";
import { SignOutButton } from "@/components/sign-out-button";
import { SourceHealthBadge } from "@/components/source-health-badge";
import { formatSofiaDateTime } from "@/lib/format";
import type { SourceHealth, UserSession } from "@/lib/types";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/overview", label: "Общ преглед", icon: Radar },
  { href: "/news", label: "Новини", icon: Newspaper },
  { href: "/calendar", label: "Календар", icon: CalendarDays },
  { href: "/cot", label: "COT позиции", icon: BarChart3 },
  { href: "/macro", label: "Макро", icon: TrendingUp },
  { href: "/signal-lab", label: "Сигнал", icon: Waypoints },
];

export function AppShell({
  session,
  staleFlags,
  generatedAt,
  children,
}: {
  session: UserSession;
  staleFlags: Record<string, SourceHealth>;
  generatedAt: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,214,102,0.18),_transparent_26%),linear-gradient(180deg,_#0a1020_0%,_#07101e_36%,_#050911_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <header className="rounded-[30px] border border-white/10 bg-white/[0.03] px-5 py-5 shadow-[0_35px_120px_rgba(5,8,20,0.55)] backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-300 text-slate-950 shadow-[0_10px_40px_rgba(251,191,36,0.35)]">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/80">
                    Анализ на злато
                  </p>
                  <p className="text-sm text-slate-300">
                    {session.email} • обновено {formatSofiaDateTime(generatedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SourceHealthBadge source="XAU" health={staleFlags.alphaVantage} />
              <SourceHealthBadge source="GDELT" health={staleFlags.gdelt} />
              <SourceHealthBadge source="FRED" health={staleFlags.fred} />
              <SourceHealthBadge source="CFTC" health={staleFlags.cftc} />
              <SourceHealthBadge source="OpenAI" health={staleFlags.openai} />
              <RefreshButton generatedAt={generatedAt} />
              <SignOutButton />
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium transition",
                    active
                      ? "border-amber-300/40 bg-amber-300/14 text-amber-100"
                      : "border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mt-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
