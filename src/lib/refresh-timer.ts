export const AUTO_REFRESH_SECONDS = 5 * 60;

export function formatRefreshCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function getInitialAutoRefreshSeconds(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);

  if (Number.isNaN(generatedAtMs)) {
    return AUTO_REFRESH_SECONDS;
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - generatedAtMs) / 1000));

  return Math.max(0, AUTO_REFRESH_SECONDS - elapsedSeconds);
}
