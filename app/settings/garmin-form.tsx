"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function GarminCredentialsForm({ hasCredentials }: { hasCredentials: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/garmin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      if (res.ok) {
        setResult("✓ Zapisano poświadczenia");
        setEmail("");
        setPassword("");
        // Reload page to update UI state
        window.location.reload();
      } else {
        const d = await res.json();
        setResult(`✗ ${d.error}`);
      }
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setSaving(false);
      setTimeout(() => setResult(null), 4000);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {result && <span className="text-xs text-muted-foreground self-center mr-1">{result}</span>}
      <input
        type="email"
        placeholder={hasCredentials ? "Zapisany email (skonfigurowano)" : "Email Garmin Connect"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-[#bce663] text-white placeholder-zinc-600"
      />
      <input
        type="password"
        placeholder={hasCredentials ? "••••••••••••••••" : "Hasło Garmin Connect"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-8 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs w-full sm:w-40 focus:outline-none focus:ring-1 focus:ring-[#bce663] text-white placeholder-zinc-600"
      />
      <Button type="submit" size="sm" variant="outline" className="border-[#2e3229] hover:bg-[#1a1c18] hover:text-[#bce663]" disabled={saving || !email.trim() || !password.trim()}>
        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Połącz"}
      </Button>
    </form>
  );
}

export function GarminSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`✓ Pomyślnie zaimportowano ${data.itemsSynced} metryk`);
        // Refresh page after delay to show new data sources
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResult(`✗ ${data.error}`);
      }
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 6000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted-foreground max-w-xs truncate">{result}</span>}
      <Button size="sm" variant="outline" className="border-[#bce663]/30 hover:bg-[#bce663]/10 hover:text-[#bce663]" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Synchronizacja..." : "Synchronizuj"}
      </Button>
    </div>
  );
}
