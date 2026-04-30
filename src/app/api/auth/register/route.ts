import { NextResponse } from "next/server";

import { env, isDemoModeEnabled, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeSupabaseAuthMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Вече има акаунт с този email. Използвай вход.";
  }

  if (normalized.includes("password")) {
    return "Паролата не отговаря на изискванията. Използвай поне 8 символа.";
  }

  if (normalized.includes("signup") || normalized.includes("signups")) {
    return "Регистрацията е изключена в Supabase Auth настройките.";
  }

  return message;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (isDemoModeEnabled) {
    return NextResponse.json(
      { message: "Регистрацията е налична само когато production Supabase входът е активен." },
      { status: 503 },
    );
  }

  if (isFirebaseConfigured) {
    return NextResponse.json(
      { message: "Регистрацията през сайта е активирана за Supabase режим." },
      { status: 503 },
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ message: "Supabase регистрацията не е конфигурирана." }, { status: 503 });
  }

  if (!email || !password) {
    return NextResponse.json({ message: "Попълни email и парола." }, { status: 400 });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ message: "Въведи валиден email адрес." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: "Паролата трябва да е поне 8 символа." }, { status: 400 });
  }

  if (body.confirmPassword !== undefined && password !== body.confirmPassword) {
    return NextResponse.json({ message: "Паролите не съвпадат." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase client is unavailable." }, { status: 500 });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/login`,
    },
  });

  if (error) {
    return NextResponse.json({ message: normalizeSupabaseAuthMessage(error.message) }, { status: 400 });
  }

  if (!data.session) {
    return NextResponse.json({
      ok: true,
      needsEmailConfirmation: true,
      message: "Регистрацията е създадена. Потвърди email-а си и след това влез.",
    });
  }

  return NextResponse.json({
    ok: true,
    needsEmailConfirmation: false,
    message: "Регистрацията е успешна.",
  });
}
