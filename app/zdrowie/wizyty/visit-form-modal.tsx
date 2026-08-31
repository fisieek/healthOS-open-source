"use client";

import { useState } from "react";
import { format } from "date-fns";
import { visitDisplayDate } from "@/lib/services/visit-dates";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  MEDICAL_SPECIALTIES,
  VISIT_STATUS_OPTIONS,
  INPUT_CLS,
  episodeStatusMeta,
  type Dictionaries,
  type VisitStatus,
} from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  dictionaries: Dictionaries;
  /** Prefill „Powód/Część ciała" (nazwa) — gdy dodajesz z widoku części ciała. */
  presetBodyPart?: string;
  /** Prefill specjalizacji — np. przy realizacji skierowania. */
  presetSpecialization?: string;
  /** Epizod leczenia na starcie (drill-down z wybranym epizodem). */
  presetEpisodeId?: string;
  /** Gdy podany — tryb edycji istniejącej wizyty. */
  editVisit?: any;
  onCreated: (visit: any) => void;
}

export function VisitFormModal({
  open,
  onClose,
  dictionaries,
  presetBodyPart,
  presetSpecialization,
  presetEpisodeId,
  editVisit,
  onCreated,
}: Props) {
  const isEdit = !!editVisit;

  const [date, setDate] = useState(() => {
    if (!editVisit) return format(new Date(), "yyyy-MM-dd");
    // Wspólny helper: dla wykonanej terminem jest `date`, dla pozostałych
    // `plannedDate` (null = termin nieustalony → puste pole).
    const raw = visitDisplayDate(editVisit);
    return raw ? format(raw, "yyyy-MM-dd") : "";
  });
  const [status, setStatus] = useState<VisitStatus>(editVisit?.status ?? "DONE");
  const [doctorName, setDoctorName] = useState(editVisit?.doctorName ?? "");
  const [specialization, setSpecialization] = useState(
    editVisit?.specialization ?? presetSpecialization ?? ""
  );
  const [facility, setFacility] = useState(editVisit?.facility ?? "");
  const [reason, setReason] = useState(editVisit?.reason ?? presetBodyPart ?? "");
  const [episodeId, setEpisodeId] = useState(
    editVisit?.episodeId ?? presetEpisodeId ?? ""
  );

  // Epizody dotyczące wpisanej części ciała. Bez wskazanej części ciała pokazujemy
  // wszystkie — wybór epizodu i tak ustawi część ciała po stronie serwera.
  const matchedBodyPart = dictionaries.bodyParts.find(
    (b) => b.name.trim().toLowerCase() === reason.trim().toLowerCase()
  );
  const episodeOptions = matchedBodyPart
    ? dictionaries.episodes.filter((e) => e.bodyPartId === matchedBodyPart.id)
    : dictionaries.episodes;
  const [summary, setSummary] = useState(editVisit?.summary ?? "");
  const [recommendations, setRecommendations] = useState(editVisit?.recommendations ?? "");
  const [followUpDate, setFollowUpDate] = useState(
    editVisit?.followUpDate ? format(new Date(editVisit.followUpDate), "yyyy-MM-dd") : ""
  );
  const [followUpNote, setFollowUpNote] = useState(editVisit?.followUpNote ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDate(format(new Date(), "yyyy-MM-dd"));
    setStatus("DONE");
    setDoctorName("");
    setSpecialization("");
    setFacility("");
    setReason(presetBodyPart ?? "");
    setSummary("");
    setRecommendations("");
    setFollowUpDate("");
    setFollowUpNote("");
    setError(null);
  };

  // Auto-uzupełnij specjalizację, gdy wpisany lekarz pasuje do słownika
  const onDoctorChange = (value: string) => {
    setDoctorName(value);
    const hit = dictionaries.doctors.find(
      (d) => d.name.toLowerCase() === value.trim().toLowerCase()
    );
    if (hit?.specialization && !specialization.trim()) {
      setSpecialization(hit.specialization);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !specialization.trim() || !reason.trim()) return;
    if (status === "DONE" && !date) {
      setError("Dla wykonanej wizyty podaj datę.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        isEdit ? `/api/health/visits/${editVisit.id}` : "/api/health/visits",
        {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          status,
          doctorName,
          specialization,
          facility,
          reason,
          episodeId: episodeId || null,
          summary,
          recommendations,
          followUpDate: followUpDate || undefined,
          followUpNote,
        }),
      });
      if (!res.ok) {
        setError("Nie udało się zapisać wizyty.");
        return;
      }
      const visit = await res.json();
      onCreated(visit);
      reset();
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
      onClose={() => {
        reset();
        onClose();
      }}
      title={isEdit ? "Edytuj wizytę lekarską" : "Dodaj wizytę lekarską"}
      description="Lekarz, placówka i Powód/Część ciała trafią do Twojego słownika."
      size="xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Status wizyty */}
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Status</Label>
          <div className="flex gap-2">
            {VISIT_STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                  status === s.value
                    ? s.value === "PLANNED"
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                      : s.value === "CANCELLED"
                      ? "bg-rose-500/15 border-rose-500/50 text-rose-300"
                      : "bg-[#bce663]/15 border-[#bce663]/50 text-[#bce663]"
                    : "bg-[#0d0e0c] border-[#2e3229] text-[#8c9282] hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">
              {status === "DONE" ? "Data wizyty" : "Planowany termin (opcjonalny)"}
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required={status === "DONE"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Lekarz</Label>
            <Input
              type="text"
              placeholder="dr Jan Kowalski"
              list="vf-doctors"
              value={doctorName}
              onChange={(e) => onDoctorChange(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Specjalizacja</Label>
            <Input
              type="text"
              placeholder="Kardiolog"
              list="vf-specialties"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Placówka</Label>
            <Input
              type="text"
              placeholder="LUX MED Warszawa"
              list="vf-facilities"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Powód / Część ciała</Label>
            <Input
              type="text"
              placeholder="Tarczyca / Kolano lewe"
              list="vf-bodyparts"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Leczenie (epizod)</Label>
          <select
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">— brak —</option>
            {episodeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({episodeStatusMeta(e.status).label})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[#5d6050]">
            Wybór leczenia ustawia też część ciała.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Wnioski / Diagnoza</Label>
          <Textarea
            placeholder="Najważniejsze wnioski..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Zalecenia</Label>
          <Textarea
            placeholder="Przepisane zalecenia..."
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Data kontroli</Label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Notatka kontroli</Label>
            <Input
              type="text"
              placeholder="Kontrola za rok"
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
          >
            {loading ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj wizytę"}
          </Button>
        </div>

        {/* Datalisty ze słowników */}
        <datalist id="vf-doctors">
          {dictionaries.doctors.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        <datalist id="vf-facilities">
          {dictionaries.facilities.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
        <datalist id="vf-bodyparts">
          {dictionaries.bodyParts.map((b) => (
            <option key={b.id} value={b.name} />
          ))}
        </datalist>
        <datalist id="vf-specialties">
          {MEDICAL_SPECIALTIES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
