import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env, isSupabaseConfigured } from "@/lib/env";

type SupabaseServerClientOptions = {
  allowCookieWrites?: boolean;
};

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (!options.allowCookieWrites) {
            return;
          }

          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        },
      },
    },
  );
}
