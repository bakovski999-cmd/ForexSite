import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isDemoModeEnabled, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import type { UserSession } from "@/lib/types";

const demoCookieName = "gold-intel-demo-session";

export async function getCurrentSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();

  if (isDemoModeEnabled) {
    const demoSession = cookieStore.get(demoCookieName)?.value;
    if (demoSession === env.APP_DEMO_SESSION_SECRET) {
      return {
        email: env.APP_DEMO_EMAIL,
        mode: "demo",
      };
    }
  }

  if (isFirebaseConfigured) {
    const firebaseSession = cookieStore.get(env.FIREBASE_SESSION_COOKIE_NAME)?.value;
    const firebaseAuth = getFirebaseAdminAuth();

    if (firebaseSession && firebaseAuth) {
      try {
        const decoded = await firebaseAuth.verifySessionCookie(firebaseSession, true);

        if (decoded.email) {
          return {
            id: decoded.uid,
            email: decoded.email,
            mode: "firebase",
          };
        }
      } catch {
        return null;
      }
    }
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    mode: "supabase",
  };
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export function getDemoCookieName() {
  return demoCookieName;
}

export function getFirebaseSessionCookieName() {
  return env.FIREBASE_SESSION_COOKIE_NAME;
}
