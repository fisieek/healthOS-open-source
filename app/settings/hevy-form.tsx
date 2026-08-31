"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function HevyApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/hevy/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });
      if (res.ok) {
        setResult("✓ Zapisano");
        setValue("");
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
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <input
        type="password"
        placeholder={hasKey ? "••••••••••••••••" : "Wklej klucz API"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-3 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving || !value.trim()}>
        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Zapisz"}
      </Button>
    </div>
  );
}

export function HevySyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/hevy/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`✓ ${data.synced} treningów`);
      } else {
        setResult(`✗ ${data.error}`);
      }
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync Hevy"}
      </Button>
    </div>
  );
}
