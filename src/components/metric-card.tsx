import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "gold" | "green" | "red" | "slate";
  className?: string;
};

const accentClasses = {
  gold: "from-amber-300/30 to-transparent ring-amber-300/20",
  green: "from-emerald-300/25 to-transparent ring-emerald-300/20",
  red: "from-rose-300/25 to-transparent ring-rose-300/20",
  slate: "from-slate-200/15 to-transparent ring-white/10",
} as const;

export function MetricCard({
  label,
  value,
  hint,
  accent = "slate",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(9,12,24,0.28)] ring-1",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b blur-2xl",
          accentClasses[accent],
        )}
      />
      <p className="relative text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="relative mt-3 text-3xl font-semibold text-white">{value}</p>
      {hint ? <p className="relative mt-2 text-sm leading-6 text-slate-300">{hint}</p> : null}
    </div>
  );
}
