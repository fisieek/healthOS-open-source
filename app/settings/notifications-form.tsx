"use client";

import { useState } from "react";
import {
  LEAD_DAYS_OPTIONS,
  type DesktopNotificationPrefs,
  type LeadDays,
} from "@/lib/constants/notifications";

interface Props {
  initial: DesktopNotificationPrefs;
}

/**
 * Ustawienia powiadomień desktopowych (poz. 9 etap 3).
 *
 * Sekcja pokazuje się **tylko w wersji desktopowej** — decyduje o tym
 * `app/settings/page.tsx` po fladze `HEALTHOS_DESKTOP`. W przeglądarce nie ma
 * czego włączać: powiadomienia pokazuje proces główny Electrona, nie strona.
 */
export function NotificationsForm({ initial }: Props) {
  const [prefs, setPrefs] = useState<DesktopNotificationPrefs>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: DesktopNotificationPrefs) {
    // Optymistycznie — przełącznik ma reagować od razu, a nie po round-tripie.
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPrefs(prefs); // cofamy do stanu sprzed kliknięcia
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#f1f2ec]">
            Przypomnienia o badaniach i wizytach
          </p>
          <p className="text-[10px] text-[#8c9282]">
            Raz dziennie, natywnym powiadomieniem macOS. Kliknięcie otwiera kalendarz.
          </p>
        </div>
        <button
          onClick={() => save({ ...prefs, enabled: !prefs.enabled })}
          disabled={saving}
          title={prefs.enabled ? "Wyłącz powiadomienia" : "Włącz powiadomienia"}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            prefs.enabled ? "bg-[#bce663]" : "bg-[#2e3229]"
          } ${saving ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[#1a1c18] transition-transform ${
              prefs.enabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {prefs.enabled && (
        <div className="space-y-3 pl-1 pt-2 border-t border-[#2e3229]">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="notif-hour"
              className="text-xs text-[#8c9282]"
            >
              Godzina sprawdzenia
            </label>
            <select
              id="notif-hour"
              value={prefs.hour}
              onChange={(e) => save({ ...prefs, hour: Number(e.target.value) })}
              disabled={saving}
              className="bg-[#111310] border border-[#2e3229] rounded-md px-2 py-1 text-xs text-[#f1f2ec]"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="notif-lead" className="text-xs text-[#8c9282]">
              Uprzedzaj o nadchodzących
            </label>
            <select
              id="notif-lead"
              value={prefs.leadDays}
              onChange={(e) =>
                save({ ...prefs, leadDays: Number(e.target.value) as LeadDays })
              }
              disabled={saving}
              className="bg-[#111310] border border-[#2e3229] rounded-md px-2 py-1 text-xs text-[#f1f2ec]"
            >
              {LEAD_DAYS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-[#8c9282]">
            Zaległe pozycje trafiają do powiadomienia zawsze, niezależnie od wyprzedzenia.
          </p>
        </div>
      )}

      {saved && <p className="text-[10px] text-[#bce663]">Zapisano.</p>}
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}
