import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { fetchValuationQuotes } from "@/lib/stock-valuation-quotes";

export const runtime = "nodejs";

function parseTickers(request: Request) {
  const url = new URL(request.url);
  const rawTickers = url.searchParams.get("tickers") ?? "";

  return Array.from(
    new Set(
      rawTickers
        .split(",")
        .map((ticker) => ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, 30);
}

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session?.id) {
    return NextResponse.json({ ok: false, error: "Real login is required." }, { status: 401 });
  }

  const tickers = parseTickers(request);
  if (tickers.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing tickers." }, { status: 400 });
  }

  const quotes = await fetchValuationQuotes(tickers);

  return NextResponse.json({ ok: true, quotes });
}
