import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const origin = env.NEXT_PUBLIC_APP_URL;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  const supabase = await createSupabaseServerClient({ allowCookieWrites: true });

  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
