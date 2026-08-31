"use client";

import { useState, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Trash2, Plus, Camera, ChevronDown, ChevronUp, Loader2, X,
  Check, Pencil, Archive, ArchiveRestore,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Ingredient {
  id?: string;
  name: string;
  amount: number | null;
  unit: string | null;
  percentDV: number | null;
  nutrientId?: string | null;
  nutrientName?: string | null;
}

export interface Supplement {
  id: string;
  name: string;
  productName: string | null;
  company: string | null;
  dose: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  goal: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  ingredients: Ingredient[];
}

export interface NutrientLite {
  id: string;
  slug: string;
  name: string;
  defaultUnit: string;
}

export interface IntakeRecord {
  id: string;
  supplementId: string;
  portion: number;
  takenAt: string;
}

interface Props {
  supplements: Supplement[];
  todayIntakes: IntakeRecord[];
  nutrients: NutrientLite[];
  hideAddButton?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isActive(s: Supplement): boolean {
  if (!s.endDate) return true;
  return new Date(s.endDate) >= new Date(todayIso());
}

function emptyIngredient(): Ingredient {
  return { name: "", amount: null, unit: null, percentDV: null, nutrientId: null };
}

function emptyForm(): SupplementFormState {
  return {
    name: "",
    company: "",
    productName: "",
    dose: "",
    servingSize: "",
    servingUnit: "",
    goal: "",
    startDate: todayIso(),
    endDate: "",
    notes: "",
    ingredients: [],
  };
}

interface SupplementFormState {
  name: string;
  company: string;
  productName: string;
  dose: string;
  servingSize: string;
  servingUnit: string;
  goal: string;
  startDate: string;
  endDate: string;
  notes: string;
  ingredients: Ingredient[];
}

// ─── Ingredient editor (shared by add and edit) ───────────────────────────────

function IngredientEditor({
  ingredients,
  setIngredients,
}: {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
}) {
  function update(i: number, field: keyof Ingredient, value: string) {
    setIngredients((prev) =>
      prev.map((ing, idx) =>
        idx === i
          ? {
              ...ing,
              [field]:
                field === "amount" || field === "percentDV"
                  ? value === "" ? null : parseFloat(value)
                  : value || null,
            }
          : ing
      )
    );
  }

  function remove(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (ingredients.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setIngredients([emptyIngredient()])}
      >
        <Plus className="h-3 w-3 mr-1" /> Dodaj składnik
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Składniki ({ingredients.length})
      </p>
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {ingredients.map((ing, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={ing.name}
              onChange={(e) => update(i, "name", e.target.value)}
              className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Nazwa"
            />
            <input
              type="number"
              step="any"
              value={ing.amount ?? ""}
              onChange={(e) => update(i, "amount", e.target.value)}
              className="w-16 h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Ilość"
            />
            <input
              type="text"
              value={ing.unit ?? ""}
              onChange={(e) => update(i, "unit", e.target.value)}
              className="w-12 h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="mg"
            />
            <input
              type="number"
              step="any"
              value={ing.percentDV ?? ""}
              onChange={(e) => update(i, "percentDV", e.target.value)}
              className="w-14 h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="% RWS"
            />
            {ing.nutrientName && (
              <span
                title={`Rozpoznano: ${ing.nutrientName}`}
                className="text-[10px] text-green-600 dark:text-green-500 px-1 shrink-0"
              >
                ✓
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
      >
        <Plus className="h-3 w-3 mr-1" /> Dodaj składnik
      </Button>
    </div>
  );
}

// ─── Edit form (inline) ───────────────────────────────────────────────────────

function EditSupplementForm({
  supplement,
  onCancel,
  onSaved,
}: {
  supplement: Supplement;
  onCancel: () => void;
  onSaved: (s: Supplement) => void;
}) {
  const [name, setName] = useState(supplement.name);
  const [company, setCompany] = useState(supplement.company ?? "");
  const [dose, setDose] = useState(supplement.dose ?? "");
  const [servingSize, setServingSize] = useState(
    supplement.servingSize != null ? String(supplement.servingSize) : ""
  );
  const [servingUnit, setServingUnit] = useState(supplement.servingUnit ?? "");
  const [goal, setGoal] = useState(supplement.goal ?? "");
  const [startDate, setStartDate] = useState(supplement.startDate.slice(0, 10));
  const [endDate, setEndDate] = useState(supplement.endDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(supplement.notes ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(supplement.ingredients);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/health/supplements/${supplement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          dose,
          servingSize: servingSize === "" ? null : Number(servingSize),
          servingUnit,
          goal,
          startDate,
          endDate: endDate || null,
          notes,
          ingredients,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error ?? "Błąd zapisu");
        return;
      }
      const updated = await res.json();
      onSaved({
        ...updated,
        startDate: updated.startDate,
        endDate: updated.endDate,
      });
    } catch {
      setErr("Błąd połączenia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 p-3 bg-muted/40">
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          type="text"
          placeholder="Nazwa *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Producent"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Cel"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="any"
            placeholder="Porcja"
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            className="w-20 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="text"
            placeholder="tabletka"
            value={servingUnit}
            onChange={(e) => setServingUnit(e.target.value)}
            className="flex-1 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <input
          type="text"
          placeholder="Dawka (notatka)"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          required
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Koniec"
        />
        <input
          type="text"
          placeholder="Notatki"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <IngredientEditor ingredients={ingredients} setIngredients={setIngredients} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Zapisuję…" : "Zapisz"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Anuluj
        </Button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </form>
  );
}

// ─── Single supplement card ───────────────────────────────────────────────────

function SupplementCard({
  sup,
  todayIntakeCount,
  todayPortion,
  onDelete,
  onArchive,
  onUnarchive,
  onEdited,
}: {
  sup: Supplement;
  todayIntakeCount: number;
  todayPortion: number;
  onDelete: (id: string) => void;
  onArchive: (id: string, date: string) => void;
  onUnarchive: (id: string) => void;
  onEdited: (s: Supplement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showArchivePicker, setShowArchivePicker] = useState(false);
  const [archiveDate, setArchiveDate] = useState(() => todayIso());
  const hasIngredients = sup.ingredients.length > 0;
  const active = isActive(sup);
  const taken = todayIntakeCount > 0;

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <EditSupplementForm
          supplement={sup}
          onCancel={() => setEditing(false)}
          onSaved={(s) => { onEdited(s); setEditing(false); }}
        />
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-background overflow-hidden ${taken ? "border-green-600/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{sup.name}</p>
            {taken && (
              <span className="text-[10px] text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded">
                Dziś × {todayPortion}
              </span>
            )}
          </div>
          {sup.company && (
            <p className="text-xs text-muted-foreground">{sup.company}</p>
          )}
          <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
            {sup.servingSize != null && (
              <span>Porcja: {sup.servingSize}{sup.servingUnit ? ` ${sup.servingUnit}` : ""}</span>
            )}
            {sup.dose && <span>{sup.dose}</span>}
            {sup.goal && <span className="italic">{sup.goal}</span>}
            <span>od {format(new Date(sup.startDate), "d MMM yyyy", { locale: pl })}</span>
            {sup.endDate && (
              <span>do {format(new Date(sup.endDate), "d MMM yyyy", { locale: pl })}</span>
            )}
          </div>
          {sup.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">{sup.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showArchivePicker ? (
            <div className="flex items-center gap-1.5 bg-[#1b1c16] border border-[#2b2d24] rounded-lg p-1 animate-in fade-in slide-in-from-right-1 duration-200">
              <span className="text-[10px] text-muted-foreground pl-1">Zakończ:</span>
              <button
                type="button"
                onClick={() => {
                  onArchive(sup.id, todayIso());
                  setShowArchivePicker(false);
                }}
                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Dziś
              </button>
              <input
                type="date"
                value={archiveDate}
                onChange={(e) => setArchiveDate(e.target.value)}
                className="h-6 w-28 rounded border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => {
                  if (archiveDate) {
                    onArchive(sup.id, archiveDate);
                    setShowArchivePicker(false);
                  }
                }}
                className="p-1 rounded text-green-500 hover:bg-accent transition-colors"
                title="Zatwierdź datę"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowArchivePicker(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Anuluj"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              {hasIngredients && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded transition-colors"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {sup.ingredients.length}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Edytuj"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {active ? (
                <button
                  onClick={() => setShowArchivePicker(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Zakończ branie (archiwizuj)"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onUnarchive(sup.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Wznów (usuń datę zakończenia)"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onDelete(sup.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                title="Usuń"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && hasIngredients && (
        <div className="border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Składnik</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Rozpoznano</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Ilość</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">% RWS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sup.ingredients.map((ing, i) => (
                <tr key={ing.id ?? i}>
                  <td className="px-3 py-1.5">{ing.name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {ing.nutrientName ?? <span className="text-muted-foreground/60 italic">brak mapowania</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {ing.amount != null ? `${ing.amount} ${ing.unit ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {ing.percentDV != null ? `${ing.percentDV}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Add form (with AI scan) ──────────────────────────────────────────────────

function AddSupplementForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (s: Supplement) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<SupplementFormState>(emptyForm());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function setField<K extends keyof SupplementFormState>(key: K, value: SupplementFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "image/jpeg";
    setImageMime(mime);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleAnalyze() {
    if (!imageBase64) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch("/api/health/supplements/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeResult(`✗ ${data.error}`);
        return;
      }
      setForm((prev) => ({
        ...prev,
        name: data.productName || prev.name,
        productName: data.productName || prev.productName,
        company: data.company || prev.company,
        servingSize: data.servingSize != null ? String(data.servingSize) : prev.servingSize,
        servingUnit: data.servingUnit || prev.servingUnit,
        ingredients: (data.ingredients ?? []) as Ingredient[],
      }));
      setAnalyzeResult(`✓ Rozpoznano ${data.ingredients?.length ?? 0} składników`);
    } catch {
      setAnalyzeResult("✗ Błąd połączenia");
    } finally {
      setAnalyzing(false);
      setTimeout(() => setAnalyzeResult(null), 5000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setAdding(true);
    setResult(null);
    try {
      const res = await fetch("/api/health/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          productName: form.productName || form.name,
          company: form.company,
          dose: form.dose,
          servingSize: form.servingSize === "" ? null : Number(form.servingSize),
          servingUnit: form.servingUnit,
          goal: form.goal,
          startDate: form.startDate,
          endDate: form.endDate || null,
          notes: form.notes,
          ingredients: form.ingredients,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setResult(`✗ ${d.error}`);
        return;
      }
      const sup = await res.json();
      onCreated(sup);
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setAdding(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
      {/* AI scan */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skanuj etykietę (AI)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {imagePreview ? (
          <div className="space-y-2">
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Etykieta" className="h-28 rounded-md border border-border object-contain" />
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageBase64(null); }}
                className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analizuję…</>
                ) : ("Analizuj (AI)")}
              </Button>
              {analyzeResult && <span className="text-xs text-muted-foreground">{analyzeResult}</span>}
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Wgraj zdjęcie etykiety
          </Button>
        )}
      </div>

      <hr className="border-border" />

      {/* Manual fields */}
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          type="text"
          placeholder="Nazwa suplementu *"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          className="col-span-2 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Producent / firma"
          value={form.company}
          onChange={(e) => setField("company", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Cel (np. odporność)"
          value={form.goal}
          onChange={(e) => setField("goal", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            placeholder="Porcja"
            value={form.servingSize}
            onChange={(e) => setField("servingSize", e.target.value)}
            className="w-24 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="text"
            placeholder="tabletka / kapsułka / ml"
            value={form.servingUnit}
            onChange={(e) => setField("servingUnit", e.target.value)}
            className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <input
          type="text"
          placeholder="Dawka — notatka (opcjonalnie)"
          value={form.dose}
          onChange={(e) => setField("dose", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          placeholder="Notatki"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          className="col-span-2 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Od</label>
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(e) => setField("startDate", e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Do (opcjonalnie)</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setField("endDate", e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <IngredientEditor
        ingredients={form.ingredients}
        setIngredients={(updater) =>
          setForm((prev) => ({
            ...prev,
            ingredients:
              typeof updater === "function"
                ? (updater as (p: Ingredient[]) => Ingredient[])(prev.ingredients)
                : updater,
          }))
        }
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={adding}>
          {adding ? "Zapisuję…" : "Zapisz suplement"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Anuluj
        </Button>
        {result && <span className="text-xs text-muted-foreground">{result}</span>}
      </div>
    </form>
  );
}

// ─── Main manager ─────────────────────────────────────────────────────────────

export interface SupplementManagerHandle {
  openAddForm: () => void;
}

export const SupplementManager = forwardRef<SupplementManagerHandle, Props>(
  ({ supplements: initial, todayIntakes: initialIntakes, nutrients, hideAddButton = false }: Props, ref) => {
    const router = useRouter();
    const [supplements, setSupplements] = useState(initial);
    const [intakes, setIntakes] = useState<IntakeRecord[]>(initialIntakes);
    const [tab, setTab] = useState<"active" | "archived">("active");
    const [showAdd, setShowAdd] = useState(false);

    useImperativeHandle(ref, () => ({
      openAddForm() {
        setShowAdd(true);
      }
    }));

  const intakesBySupplement = useMemo(() => {
    const map = new Map<string, { count: number; portion: number }>();
    for (const i of intakes) {
      const cur = map.get(i.supplementId) ?? { count: 0, portion: 0 };
      cur.count += 1;
      cur.portion += i.portion;
      map.set(i.supplementId, cur);
    }
    return map;
  }, [intakes]);

  const active = supplements.filter(isActive);
  const archived = supplements.filter((s) => !isActive(s));
  const visible = tab === "active" ? active : archived;

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten suplement na stałe? (intake'i z dnia zostaną z nim usunięte)")) return;
    await fetch(`/api/health/supplements/${id}`, { method: "DELETE" });
    setSupplements((prev) => prev.filter((s) => s.id !== id));
    setIntakes((prev) => prev.filter((i) => i.supplementId !== id));
    router.refresh();
  }

  async function handleArchive(id: string, date: string) {
    const res = await fetch(`/api/health/supplements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: date }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSupplements((prev) => prev.map((s) => (s.id === id ? { ...s, endDate: updated.endDate } : s)));
      router.refresh();
    }
  }

  async function handleUnarchive(id: string) {
    const res = await fetch(`/api/health/supplements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: null }),
    });
    if (res.ok) {
      setSupplements((prev) => prev.map((s) => (s.id === id ? { ...s, endDate: null } : s)));
      router.refresh();
    }
  }

  async function handleTaken(id: string, portion: number) {
    const res = await fetch(`/api/health/supplements/${id}/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portion }),
    });
    if (res.ok) {
      const intake = await res.json();
      setIntakes((prev) => [
        ...prev,
        { id: intake.id, supplementId: id, portion, takenAt: intake.takenAt },
      ]);
      router.refresh();
    }
  }

  function handleEdited(updated: Supplement) {
    setSupplements((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    router.refresh();
  }

  function handleCreated(created: Supplement) {
    setSupplements((prev) => [created, ...prev]);
    setShowAdd(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Tabs + add */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
          <button
            onClick={() => setTab("active")}
            className={`px-3 py-1 rounded-md transition-colors ${
              tab === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aktywne ({active.length})
          </button>
          <button
            onClick={() => setTab("archived")}
            className={`px-3 py-1 rounded-md transition-colors ${
              tab === "archived" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archiwum ({archived.length})
          </button>
        </div>
        {!showAdd && !hideAddButton && (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Dodaj suplement
          </Button>
        )}
      </div>

      {showAdd && (
        <AddSupplementForm onCancel={() => setShowAdd(false)} onCreated={handleCreated} />
      )}

      {/* List */}
      {visible.length === 0 ? (
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground py-4 text-center">
            {tab === "active" ? "Brak aktywnych suplementów." : "Brak zarchiwizowanych suplementów."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((sup) => {
            const stats = intakesBySupplement.get(sup.id) ?? { count: 0, portion: 0 };
            return (
              <SupplementCard
                key={sup.id}
                sup={sup}
                todayIntakeCount={stats.count}
                todayPortion={stats.portion}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onEdited={handleEdited}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
);
SupplementManager.displayName = "SupplementManager";
