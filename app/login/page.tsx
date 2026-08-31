"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
      return;
    }

    // Sprawdź czy to first-run (brak userów) → przekieruj na rejestrację
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasUsers) {
          router.replace("/register");
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => setCheckingSetup(false));
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Nieprawidłowy email lub hasło.");
    } else {
      // Pełny page reload zamiast soft navigation —
      // wymusza ponowne wykonanie auth() w server layout
      // (inaczej aside z nawigacją się nie pojawi)
      window.location.href = "/";
    }
  }

  if (checkingSetup) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0d0e0c] text-white">
        <div className="animate-pulse text-[#8e9182] text-sm">Ładowanie...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0d0e0c] text-white">
      <div className="w-full max-w-sm space-y-6 p-8 border border-[#2b2d24] rounded-2xl bg-[#1a1c18] shadow-2xl relative overflow-hidden">
        {/* Glow effect in background */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-[#bce663]/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-[#bce663]/5 blur-3xl pointer-events-none" />

        <div className="text-center">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#bce663] items-center justify-center font-black text-black text-xl mb-3 shadow-lg shadow-[#bce663]/10">
            h
          </div>
          <h1 className="text-2xl font-bold tracking-tight">healthOS</h1>
          <p className="text-xs text-[#8e9182] mt-1.5">Zaloguj się do swojego konta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="twój@email.pl"
              className="w-full px-3.5 py-2.5 text-sm border border-[#2b2d24] rounded-xl bg-[#121310] focus:outline-none focus:border-[#bce663] text-white transition-all placeholder-[#5d6050]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm border border-[#2b2d24] rounded-xl bg-[#121310] focus:outline-none focus:border-[#bce663] text-white transition-all placeholder-[#5d6050]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-3 rounded-xl">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-6 rounded-xl bg-[#bce663] text-black font-extrabold hover:bg-[#a6cc4f] active:scale-[0.98] transition-all text-xs uppercase tracking-wider shadow-lg shadow-[#bce663]/10"
          >
            {loading ? "Logowanie…" : "Zaloguj się"}
          </Button>
        </form>

        <div className="text-center border-t border-[#2b2d24] pt-4 mt-2">
          <p className="text-xs text-[#8e9182]">
            Nie masz jeszcze konta?{" "}
            <Link href="/register" className="font-bold text-[#bce663] hover:underline">
              Zarejestruj się
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
