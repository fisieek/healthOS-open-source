"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

export function StravaBackfillButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleBackfill() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/strava/backfill?limit=50", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `✓ ${data.processed} dofeczowanych${data.errors ? `, ${data.errors} błędów` : ""}`
        );
      } else {
        setResult(`✗ ${data.error}`);
      }
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 8000);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <Button size="sm" variant="outline" onClick={handleBackfill} disabled={loading}>
        <History className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Backfill…" : "Backfill"}
      </Button>
    </div>
  );
}
