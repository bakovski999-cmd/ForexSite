import type { SourceHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

const labelByHealth: Record<SourceHealth, string> = {
  fresh: "на живо",
  stale: "остаряло",
  fallback: "няма live",
};

const colorByHealth: Record<SourceHealth, string> = {
  fresh: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  stale: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  fallback: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

export function SourceHealthBadge({
  health,
  source,
  className,
}: {
  health: SourceHealth;
  source?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.08em] uppercase",
        colorByHealth[health],
        className,
      )}
    >
      {source ? `${source}: ` : ""}
      {labelByHealth[health]}
    </span>
  );
}
