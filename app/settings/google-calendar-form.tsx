"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface PreviewRow {
  agendaItemId: string;
  kind: string;
  event: {
    summary: string;
    location?: string;
    start: { date: string };
  };
}

interface Props {
  connected: boolean;
  lastSyncedAt: string | null;
  hasCredentials: boolean;
  savedClientId: string | null;
  /** Adres powrotny do wklejenia w Google Cloud Console. */
  redirectUri: string;
}

/**
 * Kalendarz Google w Ustawieniach (poz. 9 etap 4).
 *
 * **Każdy użytkownik podaje własne klucze OAuth.** Decyzja świadoma: wariant
 * ze wspólnym kluczem wbudowanym w aplikację wymagałby weryfikacji Google,
 * a przy niej dane kontaktowe autora są publiczne na ekranie zgody.
 * Dlatego instrukcja „jak zdobyć klucze" musi być tutaj, w aplikacji — to nie
 * jest wiedza, którą użytkownik ma skądkolwiek mieć.
 */
export function GoogleCalendarForm({
  connected,
  lastSyncedAt,
  hasCredentials,
  savedClientId,
  redirectUri,
}: Props) {
  const router = useRouter();
  const [showSetup, setShowSetup] = useState(!hasCredentials);
  const [clientId, setClientId] = useState(savedClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function saveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/google-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      if (!res.ok) throw new Error();
      setClientSecret("");
      setShowSetup(false);
      router.refresh();
    } catch {
      setError("Nie udało się zapisać kluczy.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    setBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/google-calendar/sync");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPreview(data.rows as PreviewRow[]);
    } catch {
      setError("Nie udało się policzyć zdarzeń.");
    } finally {
      setBusy(false);
    }
  }

  async function doSync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google-calendar/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "");
      setSyncResult(
        `Wysłano: ${data.created} nowych, ${data.updated} zmienionych, ${data.deleted} usuniętych.`
      );
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Synchronizacja nie powiodła się.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    const removeEvents = confirm(
      "Rozłączyć konto Google?\n\nOK = usuń też wysłane zdarzenia z kalendarza.\nAnuluj za chwilę = zostaw je w kalendarzu."
    );
    if (
      !removeEvents &&
      !confirm("Rozłączyć, ale ZOSTAWIĆ wysłane zdarzenia w kalendarzu Google?")
    ) {
      return;
    }
    setBusy(true);
    try {
      await fetch(
        `/api/integrations/google-calendar/disconnect${removeEvents ? "?removeEvents=1" : ""}`,
        { method: "POST" }
      );
      setPreview(null);
      setSyncResult(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            G
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Kalendarz Google</p>
            <p className="text-[10px] text-[#8c9282]">
              {connected
                ? lastSyncedAt
                  ? `Połączono · ostatnio wysłano ${new Date(lastSyncedAt).toLocaleString("pl")}`
                  : "Połączono · jeszcze nic nie wysłano"
                : hasCredentials
                  ? "Klucze zapisane — pozostało połączyć konto"
                  : "Niepołączono"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCredentials && !connected && (
            <a href="/api/integrations/google-calendar/connect">
              <Button size="sm">Połącz</Button>
            </a>
          )}
          {connected && (
            <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
              Rozłącz
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSetup(!showSetup)}
            className="text-[#8c9282]"
          >
            {showSetup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── Konfiguracja kluczy ── */}
      {showSetup && (
        <form onSubmit={saveCredentials} className="space-y-3 pl-11 pt-2 border-t border-[#2e3229]">
          <div className="text-[10px] text-[#8c9282] space-y-1.5">
            <p className="text-[#f1f2ec] font-medium">
              Jak zdobyć klucze (jednorazowo, ~10 minut)
            </p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>
                Wejdź na{" "}
                <span className="text-[#bce663]">console.cloud.google.com</span> i utwórz
                projekt.
              </li>
              <li>
                Wyszukaj <span className="text-[#bce663]">Google Calendar API</span> i kliknij
                „Włącz".
              </li>
              <li>
                W „Ekran zgody OAuth" wybierz <b>Zewnętrzny</b>, podaj nazwę i swój e-mail.
                Na koniec kliknij <b>Opublikuj aplikację</b> — inaczej Google będzie
                rozłączać integrację co 7 dni.
              </li>
              <li>
                „Dane logowania" → „Utwórz dane logowania" → <b>Identyfikator klienta OAuth</b>{" "}
                → typ <b>Aplikacja internetowa</b>.
              </li>
              <li>W „Autoryzowane identyfikatory URI przekierowania" wklej adres poniżej.</li>
              <li>Skopiuj identyfikator klienta i tajny klucz do pól pod spodem.</li>
            </ol>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-[#8c9282]">
              Adres przekierowania — wklej go w Google
            </label>
            <div className="flex gap-2">
              <code className="flex-1 text-[10px] bg-[#0d0e0c] border border-[#2e3229] rounded-md px-2 py-2 text-[#bce663] break-all">
                {redirectUri}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(redirectUri);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-[#5d6050]">
              Używasz też aplikacji na Macu? Dodaj w Google oba adresy — ten powyżej oraz
              wersję z portem <b>41872</b> zamiast 3000.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-[#8c9282]">Identyfikator klienta</label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="…apps.googleusercontent.com"
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#8c9282]">Tajny klucz klienta</label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasCredentials ? "zapisany — wklej, by zmienić" : "GOCSPX-…"}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={busy}>
            Zapisz klucze
          </Button>
        </form>
      )}

      {/* ── Wysyłka ── */}
      {connected && (
        <div className="space-y-2 pl-11 pt-2 border-t border-[#2e3229]">
          {preview === null ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-[#8c9282]">
                Nic nie wychodzi automatycznie — najpierw zobacz, co wyślemy.
              </p>
              <Button size="sm" variant="outline" onClick={loadPreview} disabled={busy}>
                Zobacz, co wyślę
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#f1f2ec]">
                Do wysłania: {preview.length}{" "}
                {preview.length === 1 ? "zdarzenie" : "zdarzeń"}
              </p>
              <ul className="space-y-1 max-h-56 overflow-y-auto">
                {preview.map((r) => (
                  <li key={r.agendaItemId} className="text-[10px] text-[#8c9282]">
                    <span className="text-[#5d6050] font-mono">{r.event.start.date}</span>{" "}
                    <span className="text-[#f1f2ec]">{r.event.summary}</span>
                    {r.event.location && (
                      <span className="text-[#5d6050]"> · {r.event.location}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" onClick={doSync} disabled={busy}>
                  Wyślij do Google
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreview(null)}>
                  Anuluj
                </Button>
              </div>
            </div>
          )}
          {syncResult && <p className="text-[10px] text-[#bce663]">{syncResult}</p>}
        </div>
      )}

      {error && <p className="text-[10px] text-rose-400 pl-11">{error}</p>}
    </div>
  );
}
