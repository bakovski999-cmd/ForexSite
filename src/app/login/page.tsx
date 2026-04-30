import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles, TimerReset } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import {
  env,
  isDemoModeEnabled,
  isFirebaseConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { getCurrentSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/overview");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.22),_transparent_28%),linear-gradient(180deg,_#07101e_0%,_#050911_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="flex flex-col justify-between rounded-[34px] border border-white/10 bg-[#081120]/70 p-8 shadow-[0_35px_120px_rgba(5,8,20,0.55)] backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/80">
              Табло за анализ на злато
            </p>
            <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[1.02] text-white sm:text-6xl">
              Ясен контролен център за златото, без шум и без разпилян контекст.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Новини, COT позициониране, макро драйвери и вероятностен модел за посока в една работна среда,
              подредена за ежедневно следене.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <Sparkles className="size-5 text-amber-200" />
              <p className="mt-4 text-lg font-semibold text-white">Обяснения на български</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Всяка новина е преведена в разбираем пазарен контекст.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <ShieldCheck className="size-5 text-emerald-200" />
              <p className="mt-4 text-lg font-semibold text-white">Лично приложение</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Входът е затворен и е подготвен за Firebase удостоверяване.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <TimerReset className="size-5 text-sky-200" />
              <p className="mt-4 text-lg font-semibold text-white">Обновяване</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Данните могат да се обновяват ръчно още от първата версия.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[34px] border border-white/10 bg-[#0f1729]/88 p-8 shadow-[0_35px_120px_rgba(5,8,20,0.55)] backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/80">
              Защитен достъп
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Вход към работното табло</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {isFirebaseConfigured && !isDemoModeEnabled
                ? "Приложението използва Firebase Auth. Въведи email и парола от твоя Firebase потребител."
                : isSupabaseConfigured && !isDemoModeEnabled
                  ? "Приложението е готово за Supabase вход с email и парола. Въведи валидните акаунт данни."
                  : "В момента приложението е в демо режим, докато включиш production auth и постоянна база."}
            </p>

            <div className="mt-8">
              <LoginForm
                demoEmail={env.APP_DEMO_EMAIL}
                demoPassword={env.APP_DEMO_PASSWORD}
                modeLabel={
                  isDemoModeEnabled
                    ? "Демо / локален преглед"
                    : isFirebaseConfigured
                      ? "Firebase Auth"
                      : "Supabase вход"
                }
                authProvider={!isDemoModeEnabled && isFirebaseConfigured ? "firebase" : "server"}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
