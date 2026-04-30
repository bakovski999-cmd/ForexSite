"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  AUTO_REFRESH_SECONDS,
  formatRefreshCountdown,
  getInitialAutoRefreshSeconds,
} from "@/lib/refresh-timer";

type RefreshResponse = {
  ok: boolean;
  message?: string;
  retryAfterSeconds?: number;
};

type RefreshMode = "manual" | "auto";

export function RefreshButton({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsUntilAuto, setSecondsUntilAuto] = useState(AUTO_REFRESH_SECONDS);
  const [pending, startTransition] = useTransition();

  const refreshNow = useCallback(async (mode: RefreshMode = "manual") => {
    if (isSubmittingRef.current) {
      return;
    }

    setFeedback(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
      });

      const result = (await response.json()) as RefreshResponse;

      if (!response.ok) {
        setFeedback(result.message ?? "Refresh failed");
        if (result.retryAfterSeconds) {
          setSecondsUntilAuto(Math.max(result.retryAfterSeconds, AUTO_REFRESH_SECONDS));
        }
        return;
      }

      setSecondsUntilAuto(AUTO_REFRESH_SECONDS);
      setFeedback(mode === "auto" ? "Автоматично обновено." : result.message ?? "Обновено");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSecondsUntilAuto(getInitialAutoRefreshSeconds(generatedAt));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [generatedAt]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondsUntilAuto((currentSeconds) => {
        if (currentSeconds <= 1) {
          void refreshNow("auto");
          return AUTO_REFRESH_SECONDS;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [refreshNow]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void refreshNow("manual")}
        disabled={pending || isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-sm font-medium text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending || isSubmitting ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Обнови
      </button>
      <span className="inline-flex h-9 items-center rounded-full border border-amber-200/18 bg-amber-200/10 px-3 text-xs font-medium text-amber-100">
        Авто след {formatRefreshCountdown(secondsUntilAuto)}
      </span>
      {feedback ? <p className="text-sm text-slate-300">{feedback}</p> : null}
    </div>
  );
}
