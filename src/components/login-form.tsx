"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { KeyRound, Mail, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getFirebaseBrowserAuth } from "@/lib/firebase/client";

type LoginFormProps = {
  demoEmail: string;
  demoPassword: string;
  modeLabel: string;
  authProvider: "server" | "firebase";
  canRegister: boolean;
};

type AuthMode = "login" | "register";

export function LoginForm({
  demoEmail,
  demoPassword,
  modeLabel,
  authProvider,
  canRegister,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isRegistering = authMode === "register";

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError(null);
    setNotice(null);
    setPending(false);
    setConfirmPassword("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    if (isRegistering) {
      if (!canRegister) {
        setPending(false);
        setError("Регистрацията не е активна за текущия режим на вход.");
        return;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = (await response.json()) as {
        message?: string;
        needsEmailConfirmation?: boolean;
      };

      if (!response.ok) {
        setPending(false);
        setError(data.message ?? "Неуспешна регистрация");
        return;
      }

      if (data.needsEmailConfirmation) {
        setPending(false);
        setAuthMode("login");
        setConfirmPassword("");
        setNotice(data.message ?? "Потвърди email-а си и след това влез.");
        return;
      }

      router.push("/overview");
      router.refresh();
      return;
    }

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
      {canRegister ? (
        <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`h-11 rounded-full text-sm font-semibold transition ${
              !isRegistering
                ? "bg-amber-300 text-slate-950"
                : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
              isRegistering
                ? "bg-amber-300 text-slate-950"
                : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <UserPlus className="size-4" />
            Регистрация
          </button>
        </div>
      ) : null}

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

      {isRegistering ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Повтори паролата</label>
          <div className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
            <KeyRound className="size-4 text-slate-400" />
            <input
              required
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-full w-full bg-transparent text-white outline-none placeholder:text-slate-500"
              placeholder="Повтори паролата"
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-sm leading-6 text-amber-100/90">
        Режим: {modeLabel}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {notice ? <p className="text-sm leading-6 text-emerald-300">{notice}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-13 w-full items-center justify-center rounded-full bg-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
      >
        {pending
          ? isRegistering
            ? "Създаване..."
            : "Влизане..."
          : isRegistering
            ? "Създай акаунт"
            : "Влез в таблото"}
      </button>
    </form>
  );
}
