"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DENTAL_PROCEDURE_GROUPS,
  procedureNeedsTooth,
} from "@/lib/constants/dental";
import { episodeStatusMeta, type Dictionaries } from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  dictionaries: Dictionaries;
  /** Ząb wybrany na mapie FDI — preset dla nowego zabiegu. */
  presetTooth?: number | null;
  /** Epizod leczenia na starcie (np. z drill-downu części ciała). */
  presetEpisodeId?: string;
  /** Gdy podany — tryb edycji istniejącego zabiegu. */
  editRecord?: any;
  onSaved: (record: any) => void;
}

/**
 * Formularz zabiegu stomatologicznego — dodawanie i edycja w jednym miejscu.
 *
 * Wydzielony z `health-client.tsx` (który miał 2850 linii) z dwóch powodów:
 * żeby plik nie puchł dalej i żeby ten sam formularz dało się otworzyć
 * z drill-downu części ciała, nie tylko z mapy zębów.
 *
 * Stomatologia korzysta z tych samych słowników (lekarz / placówka) i epizodów,
 * co wizyty i badania — wcześniej była wyspą z wolnym tekstem.
 */
export function DentalFormModal({
  open,
  onClose,
  dictionaries,
  presetTooth,
  presetEpisodeId,
  editRecord,
  onSaved,
}: Props) {
  const isEdit = !!editRecord;

  const [status, setStatus] = useState<"PLANNED" | "DONE">(
    editRecord?.status ?? "DONE"
  );
  const [procedure, setProcedure] = useState(editRecord?.procedure ?? "plomba");
  const [tooth, setTooth] = useState<number | null>(
    editRecord?.toothNumber ?? presetTooth ?? null
  );
  const [date, setDate] = useState(() => {
    const raw =
      editRecord?.status === "PLANNED"
        ? editRecord?.plannedDate
        : editRecord?.date;
    return raw ? format(new Date(raw), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  });
  const [dentist, setDentist] = useState(
    editRecord?.dentistRef?.name ?? editRecord?.dentist ?? ""
  );
  const [facility, setFacility] = useState(
    editRecord?.facilityRef?.name ?? editRecord?.facility ?? ""
  );
  const [episodeId, setEpisodeId] = useState(
    editRecord?.episodeId ?? presetEpisodeId ?? ""
  );
  const [notes, setNotes] = useState(editRecord?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTooth = procedureNeedsTooth(procedure);
  const missingTooth = needsTooth && tooth === null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingTooth) return;
    if (status === "DONE" && !date) {
      setError("Dla wykonanego zabiegu podaj datę.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      toothNumber: needsTooth ? tooth : null,
      procedure,
      status,
      dentist,
      facility,
      episodeId: episodeId || null,
      notes,
    };
    if (status === "DONE") {
      payload.date = date;
      payload.plannedDate = null;
    } else {
      payload.date = date || null;
      payload.plannedDate = date || null;
    }

    try {
      const res = await fetch(
        isEdit ? `/api/health/dental/${editRecord.id}` : "/api/health/dental",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Nie udało się zapisać zabiegu.");
        return;
      }
      onSaved(await res.json());
      onClose();
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs";
  const selectCls =
    "w-full bg-[#0d0e0c] border border-[#2e3229] rounded-lg text-xs p-2 text-[#f1f2ec] focus:outline-none focus:border-[#bce663]";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={
        isEdit
          ? "Edytuj zabieg"
          : needsTooth
          ? `Dodaj zabieg · ząb FDI #${tooth ?? "—"}`
          : `Dodaj wizytę · ${procedure}`
      }
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Status — zabieg umówiony vs wykonany */}
        <div className="flex gap-2">
          {(["PLANNED", "DONE"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                status === s
                  ? s === "PLANNED"
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "bg-[#bce663]/15 border-[#bce663]/50 text-[#bce663]"
                  : "bg-[#0d0e0c] border-[#2e3229] text-[#8c9282] hover:text-white"
              }`}
            >
              {s === "PLANNED" ? "Umówiony" : "Wykonany"}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Zabieg</Label>
          <select
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            className={selectCls}
          >
            {DENTAL_PROCEDURE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {missingTooth && (
          <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Wróć na mapę i wybierz ząb, którego dotyczy zabieg.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">
              {status === "PLANNED" ? "Planowany termin" : "Data"}
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              required={status === "DONE"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Stomatolog</Label>
            <Input
              type="text"
              placeholder="dr Anna Nowak"
              list="dental-doctors"
              value={dentist}
              onChange={(e) => setDentist(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Klinika</Label>
            <Input
              type="text"
              placeholder="Dental Clinic"
              list="dental-facilities"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Leczenie (epizod)</Label>
            <select
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className={selectCls}
            >
              <option value="">— brak —</option>
              {dictionaries.episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title} ({episodeStatusMeta(ep.status).label})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#5d6050]">
              Leczenie kanałowe to jeden epizod: wizyta → RTG → zabieg → kontrola.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Notatki</Label>
          <Textarea
            placeholder="np. Ząb leczony pod mikroskopem..."
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
            disabled={loading || missingTooth}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs disabled:opacity-40"
          >
            {loading ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Zapisz zabieg"}
          </Button>
        </div>

        <datalist id="dental-doctors">
          {dictionaries.doctors.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        <datalist id="dental-facilities">
          {dictionaries.facilities.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
