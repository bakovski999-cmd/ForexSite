import { NextResponse } from "next/server";

import { getDemoCookieName, getFirebaseSessionCookieName } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(getDemoCookieName());
  response.cookies.delete(getFirebaseSessionCookieName());

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }

  return response;
}
