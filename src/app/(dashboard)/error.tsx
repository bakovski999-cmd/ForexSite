"use client";

import { RotateCcw } from "lucide-react";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-rose-300/20 bg-rose-500/8 p-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-200">
        Dashboard error
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        Временен проблем при зареждане на данните.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-100/80">
        Последният валиден snapshot трябва да остане наличен след refresh. Опитай повторно зареждане,
        а ако проблемът се повтори, sync log-ът ще покаже кой източник е паднал.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950"
      >
        <RotateCcw className="size-4" />
        Опитай пак
      </button>
    </div>
  );
}
