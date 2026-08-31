"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp } from "lucide-react";

export function StravaConnectButton({
  connected,
  initialClientId,
}: {
  connected: boolean;
  initialClientId: string | null;
}) {
  const [open, setOpen] = useState(!initialClientId);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!initialClientId);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/strava-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      if (res.ok) {
        setSaved(true);
        setOpen(false);
        setClientSecret("");
      } else {
        const data = await res.json();
        setError(data.error ?? "Błąd zapisu");
      }
    } catch {
      setError("Błąd połączenia");
    }
    setSaving(false);
  };

  return (
    <>
      {/* Connect button */}
      <div className="flex items-center gap-2">
        {saved && (
          <a href="/api/strava/connect">
            <Button variant={connected ? "outline" : "default"} size="sm">
              {connected ? "Połącz ponownie" : "Połącz"}
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-[#8c9282] hover:text-[#f1f2ec] flex items-center gap-1"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {saved ? "Zmień aplikację" : "Skonfiguruj"}
        </Button>
      </div>

      {/* Credentials form */}
      {open && (
        <form
          onSubmit={handleSave}
          className="basis-full w-full pt-3 border-t border-[#2e3229] space-y-3"
        >
          <p className="text-[10px] text-[#8c9282]">
            Utwórz aplikację na{" "}
            <span className="text-[#f1f2ec] font-mono">strava.com/settings/api</span>, wpisz
            domenę <span className="text-[#f1f2ec] font-mono">localhost</span> jako Authorization
            Callback Domain, i wklej poniżej swoje Client ID i Client Secret.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-[#8c9282]">Client ID</Label>
              <Input
                type="text"
                placeholder="np. 12345"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-[#8c9282]">
                Client Secret{saved ? " (zostaw puste = bez zmiany)" : ""}
              </Label>
              <Input
                type="password"
                placeholder={saved ? "••••••••" : "wklej secret"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required={!saved}
                className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs font-mono"
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button
            type="submit"
            disabled={saving || !clientId.trim() || (!saved && !clientSecret.trim())}
            className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs h-8 px-4"
          >
            {saving ? "Zapisuję..." : "Zapisz credentials"}
          </Button>
        </form>
      )}
    </>
  );
}
