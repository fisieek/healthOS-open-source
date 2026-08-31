"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  EPISODE_STATUS_OPTIONS,
  INPUT_CLS,
  type EpisodeStatus,
} from "./constants";

export interface EpisodeRow {
  id: string;
  bodyPartId: string;
  title: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Część ciała, której dotyczy leczenie. */
  bodyPartId: string;
  bodyPartName: string;
  /** Gdy podany — tryb edycji istniejącego epizodu. */
  editEpisode?: EpisodeRow | null;
  /** Gdy true — formularz otwiera się od razu w trybie zamykania leczenia. */
  closing?: boolean;
  onSaved: () => void;
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

export function EpisodeFormModal({
  open,
  onClose,
  bodyPartId,
  bodyPartName,
  editEpisode,
  closing = false,
  onSaved,
}: Props) {
  const isEdit = !!editEpisode;

  const [title, setTitle] = useState(
    editEpisode?.title ?? `${bodyPartName} ${new Date().getFullYear()}`
  );
  const [status, setStatus] = useState<EpisodeStatus>(
    (closing ? "RESOLVED" : (editEpisode?.status as EpisodeStatus)) ?? "ACTIVE"
  );
  const [startDate, setStartDate] = useState(
    editEpisode?.startDate
      ? format(new Date(editEpisode.startDate), "yyyy-MM-dd")
      : todayIso()
  );
  const [endDate, setEndDate] = useState(
    editEpisode?.endDate
      ? format(new Date(editEpisode.endDate), "yyyy-MM-dd")
      : closing
      ? todayIso()
      : ""
  );
  const [outcome, setOutcome] = useState(editEpisode?.outcome ?? "");
  const [notes, setNotes] = useState(editEpisode?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);

    const payload = {
      bodyPartId,
      title: title.trim(),
      status,
      startDate,
      // Datę zakończenia zapisujemy tylko dla leczenia zakończonego.
      endDate: status === "RESOLVED" ? endDate || todayIso() : null,
      outcome: outcome.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/health/episodes/${editEpisode!.id}` : "/api/health/episodes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setError("Nie udało się zapisać leczenia.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={
        closing
          ? "Zakończ leczenie"
          : isEdit
          ? "Edytuj leczenie"
          : "Nowe leczenie"
      }
      description={`${bodyPartName} — osobny wątek leczenia. Zamknięty epizod zostaje w historii, a nowy problem tej samej części ciała zakładasz jako kolejny.`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Nazwa leczenia</Label>
          <Input
            type="text"
            placeholder="np. Uraz łąkotki 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            required
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Status</Label>
          <div className="flex flex-wrap gap-2">
            {EPISODE_STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setStatus(o.value);
                  if (o.value === "RESOLVED" && !endDate) setEndDate(todayIso());
                }}
                className={`flex-1 min-w-[110px] rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                  status === o.value
                    ? o.value === "RESOLVED"
                      ? "bg-[#2e3229] border-[#3d4237] text-[#f1f2ec]"
                      : o.value === "MONITORING"
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                      : "bg-[#bce663]/15 border-[#bce663]/50 text-[#bce663]"
                    : "bg-[#0d0e0c] border-[#2e3229] text-[#8c9282] hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Początek leczenia</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required
            />
          </div>
          {status === "RESOLVED" && (
            <div className="space-y-1">
              <Label className="text-xs text-[#8c9282]">Koniec leczenia</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">
            Efekt / wynik {status === "RESOLVED" ? "" : "(opcjonalnie)"}
          </Label>
          <Input
            type="text"
            placeholder="np. wyleczone / przewlekłe — kontrola raz w roku"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Notatki</Label>
          <Textarea
            placeholder="Przebieg, zalecenia, czego pilnować..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]"
          />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
          >
            {loading
              ? "Zapisywanie..."
              : closing
              ? "Zakończ leczenie"
              : isEdit
              ? "Zapisz zmiany"
              : "Utwórz leczenie"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
