"use client";

import { signOut as signOutFirebase } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getFirebaseBrowserAuth } from "@/lib/firebase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const firebaseAuth = getFirebaseBrowserAuth();

    if (firebaseAuth) {
      await signOutFirebase(firebaseAuth).catch(() => undefined);
    }

    await fetch("/api/auth/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60"
    >
      <LogOut className="size-4" />
      Изход
    </button>
  );
}
