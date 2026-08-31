"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { formatVisitDate } from "@/lib/services/visit-dates";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import {
  EXAM_TYPE_OPTIONS,
  MEDICAL_SPECIALTIES,
  IMAGING_MODALITIES,
  episodeStatusMeta,
  visitStatusMeta,
  type Dictionaries,
  type DictVisit,
} from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  dictionaries: Dictionaries;
  presetBodyPart?: string;
  /** Rodzaj badania na starcie (np. „IMAGING" z zakładki RTG/USG). */
  presetType?: string;
  /** Epizod leczenia na starcie (drill-down z wybranym epizodem). */
  presetEpisodeId?: string;
  /** Gdy podany — tryb edycji istniejącego badania. */
  editExam?: any;
  onSaved: (doc: any) => void;
}

export function ExamFormModal({
  open,
  onClose,
  dictionaries,
  presetBodyPart,
  presetType,
  presetEpisodeId,
  editExam,
  onSaved,
}: Props) {
  const isEdit = !!editExam;

  const [status, setStatus] = useState<"PLANNED" | "DONE">(
    editExam?.status ?? "PLANNED"
  );
  const [title, setTitle] = useState(editExam?.title ?? "");
  const [type, setType] = useState(editExam?.type ?? presetType ?? "IMAGING");
  // Modalność badania obrazowego trzymamy w `tags[0]` — tak jak dotychczas
  // zapisywała ją zakładka „Badania RTG/USG" (karta czyta `doc.tags?.[0]`).
  const [modality, setModality] = useState<string>(() => {
    const tag = Array.isArray(editExam?.tags) ? editExam.tags[0] : null;
    return IMAGING_MODALITIES.includes(tag) ? tag : "USG";
  });
  const [date, setDate] = useState(() => {
    const raw = editExam?.plannedDate ?? editExam?.studyDate;
    return raw ? format(new Date(raw), "yyyy-MM-dd") : "";
  });
  const [bodyPart, setBodyPart] = useState(
    editExam?.bodyPart?.name ?? presetBodyPart ?? ""
  );
  const [orderingDoctor, setOrderingDoctor] = useState(
    editExam?.orderingDoctor?.name ?? ""
  );
  const [orderingSpecialization, setOrderingSpecialization] = useState(
    editExam?.orderingDoctor?.specialization ?? ""
  );
  const [performingDoctor, setPerformingDoctor] = useState(
    editExam?.performingDoctor?.name ?? ""
  );
  const [facility, setFacility] = useState(editExam?.facilityRef?.name ?? "");
  const [visitId, setVisitId] = useState(editExam?.visitId ?? "");
  const [episodeId, setEpisodeId] = useState(
    editExam?.episodeId ?? presetEpisodeId ?? ""
  );
  const [description, setDescription] = useState(editExam?.description ?? "");
  const [fileUrl, setFileUrl] = useState<string | null>(editExam?.fileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel =
    status === "PLANNED" ? "Planowany termin (opcjonalny)" : "Data badania";

  // Epizody dotyczące wpisanej części ciała. Dopóki nie wskazano części ciała,
  // pokazujemy wszystkie — wybór epizodu i tak ustawi część ciała po stronie serwera.
  const matchedBodyPart = dictionaries.bodyParts.find(
    (b) => b.name.trim().toLowerCase() === bodyPart.trim().toLowerCase()
  );
  const episodeOptions = matchedBodyPart
    ? dictionaries.episodes.filter((e) => e.bodyPartId === matchedBodyPart.id)
    : dictionaries.episodes;

  // Lista „Podepnij do wizyty" liczona tutaj, a nie podawana propem — dzięki temu
  // działa jednakowo w każdym miejscu montażu modala (drill-down, zakładka
  // RTG/USG, „Wyniki badań") i przelicza się, gdy user zmieni część ciała
  // albo epizod w otwartym formularzu.
  const visitOptions = useMemo(() => {
    const all = dictionaries.visits ?? [];
    let scoped: DictVisit[];
    if (episodeId) {
      scoped = all.filter((v) => v.episodeId === episodeId);
    } else if (matchedBodyPart) {
      scoped = all.filter((v) => v.bodyPartId === matchedBodyPart.id);
    } else {
      // Bez wskazanej części ciała nie mamy czym zawężać — pokazujemy komplet,
      // żeby dało się podpiąć cokolwiek.
      scoped = all;
    }

    // Aktualnie podpięta wizyta musi być na liście nawet gdy wypada poza filtr —
    // inaczej sam zapis edycji po cichu zerwałby istniejące powiązanie.
    const current = editExam?.visitId
      ? all.find((v) => v.id === editExam.visitId)
      : null;
    if (current && !scoped.some((v) => v.id === current.id)) {
      scoped = [current, ...scoped];
    }

    // Świadomie bez filtra po statusie: wizyta „Wykonana" jest najczęstszym
    // przypadkiem podpinania badania.
    return scoped.map((v) => {
      return {
        id: v.id,
        label: `${formatVisitDate(v)} · ${v.doctorName} · ${visitStatusMeta(v.status).label}`,
      };
    });
  }, [dictionaries.visits, episodeId, matchedBodyPart?.id, editExam?.visitId]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/health/documents/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Nie udało się wgrać pliku.");
        return;
      }
      const j = await res.json();
      setFileUrl(j.url);
      setFileName(j.fileName);
    } catch {
      setError("Błąd sieci przy uploadzie.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type) return;
    if (status === "DONE" && !date) {
      setError("Dla wykonanego badania podaj datę.");
      return;
    }
    setLoading(true);
    setError(null);

    const otherTags: string[] = Array.isArray(editExam?.tags)
      ? editExam.tags.filter((t: unknown) => !IMAGING_MODALITIES.includes(t as string))
      : [];

    const payload: Record<string, unknown> = {
      title,
      type,
      status,
      bodyPart,
      orderingDoctor,
      orderingSpecialization,
      performingDoctor,
      facility,
      visitId: visitId || null,
      episodeId: episodeId || null,
      description,
      fileUrl,
      // Modalność trzymamy w `tags[0]`. Pozostałe tagi użytkownika (np. „morfologia")
      // przepisujemy bez zmian — edycja badania nie może ich kasować.
      tags: type === "IMAGING" ? [modality, ...otherTags] : otherTags,
    };
    if (status === "DONE") {
      payload.studyDate = date;
      payload.plannedDate = null;
    } else {
      payload.plannedDate = date || null;
    }

    try {
      const url = isEdit
        ? `/api/health/documents/${editExam.id}`
        : "/api/health/documents";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError("Nie udało się zapisać badania.");
        return;
      }
      const doc = await res.json();
      onSaved(doc);
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
      title={isEdit ? "Edytuj badanie" : "Dodaj badanie"}
      description="Zaplanowane lub wykonane — laboratoryjne i obrazowe (USG/RTG)."
      size="xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Status toggle */}
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
              {s === "PLANNED" ? "Do zrobienia" : "Zrobione"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Nazwa badania</Label>
            <Input
              type="text"
              placeholder="USG tarczycy / TSH, FT3, FT4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Rodzaj</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50"
            >
              {EXAM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {type === "IMAGING" && (
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Metoda obrazowania</Label>
            <div className="flex flex-wrap gap-2">
              {IMAGING_MODALITIES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModality(m)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                    modality === m
                      ? "bg-[#4dc9f6]/15 border-[#4dc9f6]/50 text-[#4dc9f6]"
                      : "bg-[#0d0e0c] border-[#2e3229] text-[#8c9282] hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">{dateLabel}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
              required={status === "DONE"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Powód / Część ciała</Label>
            <Input
              type="text"
              placeholder="Tarczyca"
              list="ef-bodyparts"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Kto zlecił (lekarz)</Label>
            <Input
              type="text"
              placeholder="dr Jan Kowalski"
              list="ef-doctors"
              value={orderingDoctor}
              onChange={(e) => {
                const name = e.target.value;
                setOrderingDoctor(name);
                // Auto-uzupełnij specjalizację, gdy nazwa pasuje do słownika.
                const match = dictionaries.doctors.find(
                  (d) => d.name === name && d.specialization
                );
                if (match?.specialization)
                  setOrderingSpecialization(match.specialization);
              }}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Specjalizacja</Label>
            <Input
              type="text"
              placeholder="np. Reumatolog"
              list="ef-specialties"
              value={orderingSpecialization}
              onChange={(e) => setOrderingSpecialization(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Kto wykonał (lekarz/os.)</Label>
            <Input
              type="text"
              placeholder="dr Anna Nowak"
              list="ef-doctors"
              value={performingDoctor}
              onChange={(e) => setPerformingDoctor(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Placówka wykonująca</Label>
            <Input
              type="text"
              placeholder="Synevo / Diagnostyka"
              list="ef-facilities"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Leczenie (epizod)</Label>
            <select
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Podepnij do wizyty</Label>
            <select
              value={visitId}
              onChange={(e) => setVisitId(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50"
            >
              <option value="">— brak —</option>
              {visitOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Opis / wynik (tekst)</Label>
          <Textarea
            placeholder="Opis, wnioski, wartości..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]"
          />
        </div>

        {/* Plik wyniku */}
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Plik wyniku (JPG/PNG/PDF)</Label>
          {fileUrl ? (
            <div className="flex items-center justify-between rounded-lg border border-[#2e3229] bg-[#0d0e0c] px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-[#bce663] truncate">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {fileName ?? "Załączony plik"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFileUrl(null);
                  setFileName(null);
                }}
                className="text-[#8c9282] hover:text-rose-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-[#2e3229] bg-[#0d0e0c] px-3 py-2 text-xs text-[#8c9282] cursor-pointer hover:border-[#bce663]/40">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Wgrywanie..." : "Wybierz plik"}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          )}
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
            disabled={loading || uploading}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
          >
            {loading ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj badanie"}
          </Button>
        </div>

        {/* Datalisty */}
        <datalist id="ef-doctors">
          {dictionaries.doctors.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        <datalist id="ef-facilities">
          {dictionaries.facilities.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
        <datalist id="ef-bodyparts">
          {dictionaries.bodyParts.map((b) => (
            <option key={b.id} value={b.name} />
          ))}
        </datalist>
        <datalist id="ef-specialties">
          {MEDICAL_SPECIALTIES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
