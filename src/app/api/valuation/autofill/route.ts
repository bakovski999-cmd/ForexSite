import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { fetchValuationAutofill } from "@/lib/stock-valuation-autofill";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker") ?? "";

  if (!ticker.trim()) {
    return NextResponse.json({ ok: false, error: "Ticker is required." }, { status: 400 });
  }

  const result = await fetchValuationAutofill(ticker);

  return NextResponse.json(result);
}
