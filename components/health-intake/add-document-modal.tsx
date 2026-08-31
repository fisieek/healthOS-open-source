"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, FileText, Upload } from "lucide-react";
import { IntakeFlow } from "./intake-flow";
import type { Dictionaries } from "@/app/zdrowie/wizyty/constants";
import { episodeStatusMeta } from "@/app/zdrowie/wizyty/constants";

interface ParameterEntry {
  name: string;
  value: string;
  unit: string;
}

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Gdy podane — pozwala od razu przypisać wynik do części ciała i leczenia. */
  dictionaries?: Dictionaries;
}

const DOCUMENT_TYPES = ["BLOOD_TEST", "HORMONES", "URINE_TEST", "GENETIC", "OTHER"] as const;

const DOC_TYPE_LABELS: Record<string, string> = {
  BLOOD_TEST: "Badanie krwi",
  HORMONES: "Hormony",
  URINE_TEST: "Badanie moczu",
  GENETIC: "Genetyka",
  OTHER: "Inne",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AddDocumentModal({
  isOpen,
  onClose,
  onSaved,
  dictionaries,
}: AddDocumentModalProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"upload" | "manual">("upload");
  const [saving, setSaving] = useState(false);

  // Form states dla ręcznego wpisywania
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<string>("BLOOD_TEST");
  const [formStudyDate, setFormStudyDate] = useState(todayIso());
  const [formLaboratory, setFormLaboratory] = useState("");
  const [formDoctor, setFormDoctor] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formFileUrl, setFormFileUrl] = useState("");
  const [formParameters, setFormParameters] = useState<ParameterEntry[]>([{ name: "", value: "", unit: "" }]);
  // Przypisanie od razu przy dodawaniu — bez tego wynik ląduje jako „nieprzypisany"
  // i nie widać go w widoku „Wg części ciała".
  const [formBodyPart, setFormBodyPart] = useState("");
  const [formEpisodeId, setFormEpisodeId] = useState("");
  const [formOrderingDoctor, setFormOrderingDoctor] = useState("");

  const matchedBodyPart = dictionaries?.bodyParts.find(
    (b) => b.name.trim().toLowerCase() === formBodyPart.trim().toLowerCase()
  );
  const episodeOptions = matchedBodyPart
    ? dictionaries!.episodes.filter((e) => e.bodyPartId === matchedBodyPart.id)
    : dictionaries?.episodes ?? [];

  function addParameterRow() {
    setFormParameters([...formParameters, { name: "", value: "", unit: "" }]);
  }
  function removeParameterRow(index: number) {
    setFormParameters(formParameters.filter((_, i) => i !== index));
  }
  function updateParameter(index: number, field: keyof ParameterEntry, val: string) {
    const updated = [...formParameters];
    updated[index] = { ...updated[index], [field]: val };
    setFormParameters(updated);
  }
  function resetForm() {
    setFormTitle(""); setFormType("BLOOD_TEST"); setFormStudyDate(todayIso());
    setFormLaboratory(""); setFormDoctor(""); setFormDescription("");
    setFormTags(""); setFormFileUrl("");
    setFormParameters([{ name: "", value: "", unit: "" }]);
    setFormBodyPart(""); setFormEpisodeId(""); setFormOrderingDoctor("");
    setActiveView("upload");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formStudyDate) return;
    setSaving(true);
    const params: Record<string, { value: string; unit?: string }> = {};
    for (const p of formParameters) {
      if (p.name.trim() && p.value.trim()) {
        params[p.name.trim()] = { value: p.value.trim(), ...(p.unit.trim() ? { unit: p.unit.trim() } : {}) };
      }
    }
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/health/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(), type: formType, studyDate: formStudyDate,
          laboratory: formLaboratory.trim() || null, doctor: formDoctor.trim() || null,
          description: formDescription.trim() || null, tags,
          fileUrl: formFileUrl.trim() || null,
          parameters: Object.keys(params).length > 0 ? params : null,
          bodyPart: formBodyPart.trim() || null,
          episodeId: formEpisodeId || null,
          orderingDoctor: formOrderingDoctor.trim() || null,
        }),
      });
      if (res.ok) {
        resetForm();
        onClose();
        onSaved?.();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={activeView === "upload" ? "Dodaj wynik badania" : "Wprowadź badanie ręcznie"}
      size="3xl"
    >
      <div className="space-y-4">
        {/* Przełącznik widoków */}
        <div className="flex justify-end">
          {activeView === "upload" ? (
            <button
              onClick={() => setActiveView("manual")}
              className="text-xs font-semibold text-[#bce663] hover:underline flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Wprowadź dane ręcznie
            </button>
          ) : (
            <button
              onClick={() => setActiveView("upload")}
              className="text-xs font-semibold text-[#bce663] hover:underline flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Wgraj plik PDF lub zdjęcie
            </button>
          )}
        </div>

        {activeView === "upload" ? (
          <div className="space-y-4 text-left">
            <IntakeFlow
              onSaved={() => {
                resetForm();
                onClose();
                onSaved?.();
              }}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8c9282]">Tytuł</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="np. Morfologia pełna"
                  required
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8c9282]">Typ</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOC_TYPE_LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#8c9282]">Data badania</label>
                <input
                  type="date"
                  value={formStudyDate}
                  onChange={(e) => setFormStudyDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8c9282]">Laboratorium</label>
                <input
                  type="text"
                  value={formLaboratory}
                  onChange={(e) => setFormLaboratory(e.target.value)}
                  placeholder="np. Diagnostyka"
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8c9282]">Lekarz</label>
                <input
                  type="text"
                  value={formDoctor}
                  onChange={(e) => setFormDoctor(e.target.value)}
                  placeholder="np. dr Kowalski"
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
            </div>
            {dictionaries && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-[#2e3229] bg-[#0d0e0c]/50 p-3">
                <div>
                  <label className="text-xs text-[#8c9282]">Powód / Część ciała</label>
                  <input
                    type="text"
                    list="adm-bodyparts"
                    value={formBodyPart}
                    onChange={(e) => setFormBodyPart(e.target.value)}
                    placeholder="np. Tarczyca"
                    className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                  />
                  <datalist id="adm-bodyparts">
                    {dictionaries.bodyParts.map((b) => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-[#8c9282]">Leczenie (epizod)</label>
                  <select
                    value={formEpisodeId}
                    onChange={(e) => setFormEpisodeId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                  >
                    <option value="">— brak —</option>
                    {episodeOptions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({episodeStatusMeta(e.status).label})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8c9282]">Kto zlecił</label>
                  <input
                    type="text"
                    list="adm-doctors"
                    value={formOrderingDoctor}
                    onChange={(e) => setFormOrderingDoctor(e.target.value)}
                    placeholder="np. dr Nowak"
                    className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                  />
                  <datalist id="adm-doctors">
                    {dictionaries.doctors.map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-[#8c9282]">Opis (opcjonalnie)</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] resize-none focus:outline-none focus:border-[#bce663]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8c9282]">Tagi (oddzielone przecinkami)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="np. morfologia, krew"
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8c9282]">Link do pliku (opcjonalnie)</label>
                <input
                  type="url"
                  value={formFileUrl}
                  onChange={(e) => setFormFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-1.5 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                />
              </div>
            </div>

            {/* Parametry (opcjonalnie) */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8c9282] block">Parametry badania (opcjonalnie)</label>
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                {formParameters.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nazwa (np. TSH)"
                      value={p.name}
                      onChange={(e) => updateParameter(idx, "name", e.target.value)}
                      className="h-8 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] flex-1 focus:outline-none focus:border-[#bce663]"
                    />
                    <input
                      type="text"
                      placeholder="Wartość"
                      value={p.value}
                      onChange={(e) => updateParameter(idx, "value", e.target.value)}
                      className="h-8 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] w-20 focus:outline-none focus:border-[#bce663]"
                    />
                    <input
                      type="text"
                      placeholder="Jednostka"
                      value={p.unit}
                      onChange={(e) => updateParameter(idx, "unit", e.target.value)}
                      className="h-8 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] w-20 focus:outline-none focus:border-[#bce663]"
                    />
                    <button
                      type="button"
                      onClick={() => removeParameterRow(idx)}
                      className="text-[#5d6050] hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addParameterRow}
                className="inline-flex items-center gap-1 text-xs text-[#bce663] hover:underline pt-1"
              >
                <Plus className="h-3.5 w-3.5" /> Dodaj parametr
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#2e3229]">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all disabled:opacity-50"
              >
                {saving ? "Zapisywanie..." : "Zapisz wynik"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl border border-[#2e3229] text-xs font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
