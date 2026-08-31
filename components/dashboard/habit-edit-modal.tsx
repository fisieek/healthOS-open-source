"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface Habit {
  id: string;
  name: string;
  type: "BOOLEAN" | "QUANTITY" | "TIME";
  targetValue: number | null;
  unit: string | null;
  frequency: string;
  step: number | null;
  isActive: boolean;
}

interface HabitEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const TYPE_OPTIONS = [
  { value: "BOOLEAN", label: "Tak/Nie" },
  { value: "QUANTITY", label: "Ilość (np. litry, sztuki)" },
  { value: "TIME", label: "Czas (np. minuty)" },
];

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Codziennie" },
  { value: "WEEKLY", label: "Co tydzień" },
  { value: "MONTHLY", label: "Co miesiąc" },
  { value: "YEARLY", label: "Co rok" },
];

interface HabitForm {
  name: string;
  type: "BOOLEAN" | "QUANTITY" | "TIME";
  targetValue: string;
  unit: string;
  frequency: string;
  step: string;
}

const emptyForm: HabitForm = {
  name: "",
  type: "BOOLEAN",
  targetValue: "",
  unit: "",
  frequency: "DAILY",
  step: "1",
};

export default function HabitEditModal({ isOpen, onClose, onChanged }: HabitEditModalProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<HabitForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchHabits = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/habits?activeOnly=true");
      if (res.ok) setHabits(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) fetchHabits(); }, [isOpen]);

  const startEdit = (h: Habit) => {
    setEditingId(h.id);
    setShowAddForm(false);
    setForm({
      name: h.name,
      type: h.type,
      targetValue: h.targetValue?.toString() ?? "",
      unit: h.unit ?? "",
      frequency: h.frequency,
      step: h.step?.toString() ?? "1",
    });
  };

  const startAdd = () => {
    setEditingId(null);
    setShowAddForm(true);
    setForm(emptyForm);
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowAddForm(false);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
        unit: form.unit || null,
        frequency: form.frequency,
        step: form.step ? parseFloat(form.step) : null,
      };

      const url = editingId ? `/api/habits/${editingId}` : "/api/habits";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        cancelForm();
        await fetchHabits();
        onChanged();
      }
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć ten nawyk? Historyczne wpisy pozostaną w bazie, ale nie pojawi się od dziś na liście.")) return;
    try {
      const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
      if (res.ok) { await fetchHabits(); onChanged(); }
    } catch {}
  };

  const isQty = form.type === "QUANTITY" || form.type === "TIME";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Zarządzaj nawykami"
      description="Zmiany zaczynają obowiązywać od dziś. Historyczne wpisy pozostaną nietknięte."
      size="xl"
    >
      <div className="space-y-4">
        {/* Lista nawyków */}
        {loading ? (
          <p className="text-xs text-[#8e9182] text-center py-6">Ładuję...</p>
        ) : habits.length === 0 && !showAddForm ? (
          <div className="rounded-xl border border-dashed border-[#2b2d24] p-6 text-center text-xs text-[#5d6050]">
            Brak aktywnych nawyków. Dodaj pierwszy poniżej.
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((h) => (
              <div key={h.id}>
                {editingId === h.id ? (
                  <HabitForm form={form} setForm={setForm} isQty={isQty} onSave={handleSave} onCancel={cancelForm} saving={saving} />
                ) : (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#2b2d24] bg-[#141511]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{h.name}</p>
                      <p className="text-[10px] text-[#8e9182] mt-0.5">
                        {TYPE_OPTIONS.find(t => t.value === h.type)?.label}
                        {h.targetValue != null && ` · cel: ${h.targetValue} ${h.unit ?? ""}`}
                        {h.step != null && ` · krok: ${h.step}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(h)}
                        className="p-2 rounded-lg text-[#8e9182] hover:text-[#bce663] hover:bg-[#bce663]/10 transition-all"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="p-2 rounded-lg text-[#8e9182] hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <HabitForm form={form} setForm={setForm} isQty={isQty} onSave={handleSave} onCancel={cancelForm} saving={saving} />
        )}

        {/* Add button */}
        {!showAddForm && !editingId && (
          <button
            onClick={startAdd}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2b2d24] py-3 text-xs font-bold text-[#bce663] hover:border-[#bce663] hover:bg-[#bce663]/5 transition-all"
          >
            <Plus className="h-4 w-4" />
            Dodaj nowy nawyk
          </button>
        )}
      </div>
    </Modal>
  );
}

function HabitForm({
  form, setForm, isQty, onSave, onCancel, saving,
}: {
  form: HabitForm;
  setForm: (f: HabitForm) => void;
  isQty: boolean;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(); }}
      className="space-y-3 p-4 rounded-xl border border-[#bce663]/30 bg-[#bce663]/5"
    >
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Nazwa</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="np. Woda, Medytacja, Suplementy"
          autoFocus
          required
          className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Typ</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Częstotliwość</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {isQty && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Cel</label>
            <input
              type="number"
              step="0.01"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              placeholder="3"
              className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Jednostka</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="L, kcal, min"
              className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-xs text-white outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Krok +/-</label>
            <input
              type="number"
              step="0.01"
              value={form.step}
              onChange={(e) => setForm({ ...form, step: e.target.value })}
              placeholder="0.25"
              className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-[#2b2d24] py-2 text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex-1 rounded-xl bg-[#bce663] py-2 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
        >
          {saving ? "Zapisuję..." : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
