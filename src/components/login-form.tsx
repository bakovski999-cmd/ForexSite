"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getFirebaseBrowserAuth } from "@/lib/firebase/client";

type LoginFormProps = {
  demoEmail: string;
  demoPassword: string;
  modeLabel: string;
  authProvider: "server" | "firebase";
};

export function LoginForm({ demoEmail, demoPassword, modeLabel, authProvider }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    if (authProvider === "firebase") {
      const firebaseAuth = getFirebaseBrowserAuth();

      if (!firebaseAuth) {
        setPending(false);
        setError("Firebase входът не е конфигуриран в браузъра.");
        return;
      }

      try {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const idToken = await credential.user.getIdToken();
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        });
        const data = (await response.json()) as { message?: string };

        if (!response.ok) {
          setPending(false);
          setError(data.message ?? "Неуспешен Firebase вход");
          return;
        }

        router.push("/overview");
        router.refresh();
        return;
      } catch (error) {
        setPending(false);
        setError(error instanceof Error ? error.message : "Неуспешен Firebase вход");
        return;
      }
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setPending(false);
      setError(data.message ?? "Неуспешен вход");
      return;
    }

    router.push("/overview");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Email</label>
        <div className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
          <Mail className="size-4 text-slate-400" />
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-full w-full bg-transparent text-white outline-none placeholder:text-slate-500"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Password</label>
        <div className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
          <KeyRound className="size-4 text-slate-400" />
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-full w-full bg-transparent text-white outline-none placeholder:text-slate-500"
            placeholder="Password"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-sm leading-6 text-amber-100/90">
        Режим: {modeLabel}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-13 w-full items-center justify-center rounded-full bg-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
      >
        {pending ? "Влизане..." : "Влез в таблото"}
      </button>
    </form>
  );
}
