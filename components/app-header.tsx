"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/strength": "Siła",
  "/bieg": "Bieg",
  "/cialo": "Ciało",
  "/zdrowie": "Zdrowie",
  "/asystent": "Asystent AI",
  "/settings": "Ustawienia",
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  // Znajdź etykietę dla bieżącej ścieżki
  let currentLabel = "Dashboard";
  for (const [route, label] of Object.entries(routeLabels)) {
    if (route === "/" ? pathname === "/" : pathname.startsWith(route)) {
      currentLabel = label;
      break;
    }
  }

  async function handleGlobalSync() {
    setLoading(true);
    setStatus({ type: null, message: "" });

    try {
      // Synchronizacja Strava i Hevy w tle równolegle
      const [stravaRes, hevyRes] = await Promise.allSettled([
        fetch("/api/strava/sync", { method: "POST" }),
        fetch("/api/hevy/sync", { method: "POST" }),
      ]);

      // Przelicz strefy tętna po synchronizacji (fire-and-forget)
      fetch("/api/activities/recompute", { method: "POST" }).catch(() => {});

      let stravaSuccess = false;
      let hevySuccess = false;
      let stravaCount = 0;
      let hevyCount = 0;
      let stravaNotConnected = false;
      let hevyNotConnected = false;
      let stravaError: string | null = null;
      let hevyError: string | null = null;

      if (stravaRes.status === "fulfilled") {
        if (stravaRes.value.ok) {
          const data = await stravaRes.value.json();
          stravaSuccess = true;
          stravaCount = data.synced || 0;
        } else if (stravaRes.value.status === 412) {
          stravaNotConnected = true;
        } else {
          const data = await stravaRes.value.json().catch(() => ({}));
          stravaError = data.error || `HTTP ${stravaRes.value.status}`;
        }
      } else {
        stravaError = stravaRes.reason?.message || "Błąd sieci";
      }

      if (hevyRes.status === "fulfilled") {
        if (hevyRes.value.ok) {
          const data = await hevyRes.value.json();
          hevySuccess = true;
          hevyCount = data.synced || 0;
        } else if (hevyRes.value.status === 412) {
          hevyNotConnected = true;
        } else {
          const data = await hevyRes.value.json().catch(() => ({}));
          hevyError = data.error || `HTTP ${hevyRes.value.status}`;
        }
      } else {
        hevyError = hevyRes.reason?.message || "Błąd sieci";
      }

      if (stravaSuccess || hevySuccess) {
        const total = stravaCount + hevyCount;
        setStatus({
          type: "success",
          message: `Zsynchronizowano: ${total} nowych aktywności`,
        });

        // Odświeżenie danych w Next.js na bieżącej stronie
        router.refresh();
      } else if (
        (stravaNotConnected || stravaSuccess) &&
        (hevyNotConnected || hevySuccess)
      ) {
        setStatus({
          type: "error",
          message: "Brak aktywnych integracji. Skonfiguruj je w Ustawieniach.",
        });
      } else {
        const errorMsg = [stravaError, hevyError].filter(Boolean).join(", ");
        setStatus({
          type: "error",
          message: errorMsg
            ? `Błąd synchronizacji: ${errorMsg}`
            : "Błąd podczas synchronizacji danych",
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        message: "Błąd połączenia z serwerem",
      });
    } finally {
      setLoading(false);
      // Ukryj komunikat po 4 sekundach
      setTimeout(() => {
        setStatus({ type: null, message: "" });
      }, 4000);
    }
  }

  return (
    <header className="h-16 border-b border-[#1a1c18] bg-[#0d0e0c]/80 backdrop-blur-md px-8 flex items-center justify-between text-white select-none z-40 sticky top-0">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground/60 hover:text-white transition-colors cursor-pointer">HealthOS</span>
        <span className="text-muted-foreground/30 font-mono">/</span>
        <span className="text-[#bce663] font-semibold">{currentLabel}</span>
      </div>

      {/* Akcje nagłówka */}
      <div className="flex items-center gap-4">
        {/* Powiadomienie statusu synchronizacji */}
        {status.type && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border animate-in fade-in slide-in-from-top-2 duration-200",
              status.type === "success"
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            {status.type === "success" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Przycisk synchronizacji */}
        <button
          onClick={handleGlobalSync}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-300 relative overflow-hidden active:scale-95 cursor-pointer disabled:opacity-60",
            loading
              ? "bg-[#1a1c18] border-[#2a2c28] text-muted-foreground"
              : "bg-[#1a1c18] border-[#1a1c18] text-white hover:border-[#bce663]/50 hover:bg-[#1a1c18]/80 hover:text-[#bce663]"
          )}
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-500",
              loading && "animate-spin text-[#bce663]"
            )}
          />
          <span>{loading ? "Synchronizacja..." : "Odśwież dane"}</span>
        </button>
      </div>
    </header>
  );
}
