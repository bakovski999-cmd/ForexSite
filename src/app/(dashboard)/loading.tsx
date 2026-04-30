export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-36 max-w-3xl animate-pulse rounded-[28px] bg-white/[0.05]" />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
        <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-36 animate-pulse rounded-[24px] bg-white/[0.05]" />
        <div className="h-36 animate-pulse rounded-[24px] bg-white/[0.05]" />
        <div className="h-36 animate-pulse rounded-[24px] bg-white/[0.05]" />
      </div>
    </div>
  );
}
