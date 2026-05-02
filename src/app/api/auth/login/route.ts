import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isDemoModeEnabled, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getDemoCookieName, getFirebaseSessionCookieName } from "@/lib/auth";

const firebaseSessionExpiresIn = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; idToken?: string };

  if (body.idToken) {
    if (!isFirebaseConfigured) {
      return NextResponse.json({ message: "Firebase входът не е конфигуриран." }, { status: 503 });
    }

    const firebaseAuth = getFirebaseAdminAuth();
    if (!firebaseAuth) {
      return NextResponse.json({ message: "Firebase Admin не е наличен." }, { status: 503 });
    }

    try {
      const decoded = await firebaseAuth.verifyIdToken(body.idToken);

      if (!decoded.email) {
        return NextResponse.json({ message: "Firebase акаунтът няма email." }, { status: 401 });
      }

      const sessionCookie = await firebaseAuth.createSessionCookie(body.idToken, {
        expiresIn: firebaseSessionExpiresIn,
      });
      const response = NextResponse.json({ ok: true });
      response.cookies.set(getFirebaseSessionCookieName(), sessionCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: firebaseSessionExpiresIn / 1000,
        path: "/",
      });

      return response;
    } catch {
      return NextResponse.json({ message: "Невалиден Firebase token." }, { status: 401 });
    }
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Липсват email или password." }, { status: 400 });
  }

  if (isDemoModeEnabled && body.email === env.APP_DEMO_EMAIL && body.password === env.APP_DEMO_PASSWORD) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getDemoCookieName(), env.APP_DEMO_SESSION_SECRET, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ message: "Demo данните не съвпадат." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient({ allowCookieWrites: true });
  if (!supabase) {
    return NextResponse.json({ message: "Supabase client is unavailable." }, { status: 500 });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
