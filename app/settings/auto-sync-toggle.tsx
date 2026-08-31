"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  type: "STRAVA" | "HEVY" | "GARMIN";
  initial: boolean;
}

export function AutoSyncToggle({ type, initial }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle() {
    if (saving) return;
    setSaving(true);
    const next = !active;
    try {
      const res = await fetch(`/api/settings/datasource/${type.toLowerCase()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (res.ok) {
        setActive(next);
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={active ? "Wyłącz automatyczną synchronizację" : "Włącz automatyczną synchronizację"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        active ? "bg-primary" : "bg-muted-foreground/30"
      } ${saving ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
          active ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
