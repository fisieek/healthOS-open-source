"use client";

import { useState, useMemo, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Check, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { episodeStatusMeta, type Dictionaries } from "@/app/zdrowie/wizyty/constants";

interface Medication {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  episodeId?: string | null;
}

interface Props {
  medications: Medication[];
  /** Słowniki — potrzebne do selecta „Leczenie (epizod)". Opcjonalne, bo
   *  `/health/medications` montuje managera bez nich. */
  dictionaries?: Dictionaries;
}

export interface MedicationManagerHandle {
  openForm: () => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(d: string) {
  return format(new Date(d), "d MMM yyyy", { locale: pl });
}

/**
 * Grupa = wszystkie wpisy o tej samej nazwie leku, od najnowszego.
 *
 * Historia dawek jest realizowana wariantem A: zmiana dawki zamyka bieżący wpis
 * (`endDate`) i tworzy nowy. Dzięki temu nie tracimy poprzedniej dawki, ale lista
 * leków puchnie — stąd grupowanie po nazwie. Gdy pojawi się potrzeba wykresu
 * „dawka w czasie", właściwym rozwiązaniem będzie osobny model `MedicationDose`.
 */
interface MedGroup {
  key: string;
  name: string;
  entries: Medication[];
  /** Wpis bez `endDate` — lek nadal brany. */
  active: Medication | null;
}

function groupByName(meds: Medication[]): MedGroup[] {
  const byKey = new Map<string, Medication[]>();
  for (const m of meds) {
    const key = m.name.trim().toLowerCase();
    const list = byKey.get(key);
    if (list) list.push(m);
    else byKey.set(key, [m]);
  }

  const groups: MedGroup[] = [];
  for (const [key, entries] of byKey) {
    entries.sort((a, b) => b.startDate.localeCompare(a.startDate));
    groups.push({
      key,
      name: entries[0].name,
      entries,
      active: entries.find((e) => e.endDate === null) ?? null,
    });
  }

  // Aktywne najpierw, w obrębie sekcji alfabetycznie.
  return groups.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export const MedicationManager = forwardRef<MedicationManagerHandle, Props>(
  function MedicationManager({ medications: initial, dictionaries }, ref) {
    const router = useRouter();
    const [medications, setMedications] = useState(initial);
    const [name, setName] = useState("");
    const [dose, setDose] = useState("");
    const [frequency, setFrequency] = useState("");
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [episodeId, setEpisodeId] = useState("");
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    /** null = tryb dodawania; id = edycja istniejącego wpisu. */
    const [editId, setEditId] = useState<string | null>(null);
    const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());

    useImperativeHandle(ref, () => ({
      openForm: () => {
        resetForm();
        setShowForm(true);
      },
    }));

    const groups = useMemo(() => groupByName(medications), [medications]);
    const activeGroups = groups.filter((g) => g.active);
    const endedGroups = groups.filter((g) => !g.active);

    function resetForm() {
      setEditId(null);
      setName("");
      setDose("");
      setFrequency("");
      setStartDate(today());
      setEndDate("");
      setNotes("");
      setEpisodeId("");
    }

    function startEdit(med: Medication) {
      setEditId(med.id);
      setName(med.name);
      setDose(med.dose ?? "");
      setFrequency(med.frequency ?? "");
      setStartDate(med.startDate.slice(0, 10));
      setEndDate(med.endDate ? med.endDate.slice(0, 10) : "");
      setNotes(med.notes ?? "");
      setEpisodeId(med.episodeId ?? "");
      setShowForm(true);
    }

    /** Wstawia wpis do listy — zastępuje istniejący albo dokłada nowy. */
    function upsertLocal(med: Medication) {
      setMedications((prev) => {
        const idx = prev.findIndex((m) => m.id === med.id);
        if (idx === -1) return [med, ...prev];
        const next = [...prev];
        next[idx] = med;
        return next;
      });
    }

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!name.trim()) return;
      setSaving(true);
      setResult(null);
      const payload = {
        name,
        dose,
        frequency,
        startDate,
        endDate: endDate || null,
        notes,
        episodeId: episodeId || null,
      };
      try {
        const res = await fetch(
          editId ? `/api/health/medications/${editId}` : "/api/health/medications",
          {
            method: editId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          upsertLocal(await res.json());
          resetForm();
          setShowForm(false);
          router.refresh();
        } else {
          const d = await res.json().catch(() => ({}));
          setResult(`✗ ${d.error ?? "Nie udało się zapisać leku."}`);
        }
      } catch {
        setResult("✗ Błąd połączenia");
      } finally {
        setSaving(false);
        setTimeout(() => setResult(null), 4000);
      }
    }

    /** Zamyka lek dzisiejszą datą — bez kasowania wpisu, więc historia zostaje. */
    async function handleFinish(med: Medication) {
      try {
        const res = await fetch(`/api/health/medications/${med.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endDate: today() }),
        });
        if (res.ok) {
          upsertLocal(await res.json());
          router.refresh();
        }
      } catch {
        // ignore
      }
    }

    /**
     * „Zmień dawkę": zamyka bieżący wpis dzisiejszą datą i otwiera formularz
     * nowego z przepisaną nazwą. Stara dawka zostaje w historii.
     */
    async function handleChangeDose(med: Medication) {
      await handleFinish(med);
      resetForm();
      setName(med.name);
      setFrequency(med.frequency ?? "");
      setStartDate(today());
      setEpisodeId(med.episodeId ?? "");
      setShowForm(true);
    }

    async function handleDelete(id: string) {
      try {
        await fetch(`/api/health/medications/${id}`, { method: "DELETE" });
        setMedications((prev) => prev.filter((m) => m.id !== id));
        router.refresh();
      } catch {
        // ignore
      }
    }

    function toggleHistory(key: string) {
      setOpenHistory((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }

    if (medications.length === 0 && !showForm) {
      return (
        <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
          Brak leków. Kliknij "Dodaj" w nagłówku.
        </div>
      );
    }

    const iconBtn =
      "text-[#5d6050] hover:text-[#f1f2ec] transition-colors shrink-0";

    function renderGroup(group: MedGroup, ended: boolean) {
      const lead = group.active ?? group.entries[0];
      const history = group.entries.filter((e) => e.id !== lead.id);
      const historyOpen = openHistory.has(group.key);

      return (
        <div
          key={group.key}
          className={`rounded-lg border border-[#2e3229] bg-[#141511] p-3 ${
            ended ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f1f2ec]">{lead.name}</p>
              <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-[#8c9282]">
                {lead.dose && <span>{lead.dose}</span>}
                {lead.frequency && <span>{lead.frequency}</span>}
                <span>od {fmt(lead.startDate)}</span>
                {lead.endDate ? (
                  <span>do {fmt(lead.endDate)}</span>
                ) : (
                  <span className="text-[#bce663]">nadal</span>
                )}
              </div>
              {lead.notes && (
                <p className="text-xs text-[#8c9282] mt-0.5 italic">{lead.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={() => startEdit(lead)}
                title="Edytuj"
                className={iconBtn}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {!ended && (
                <button
                  onClick={() => handleFinish(lead)}
                  title="Zakończ — ustawia dzisiejszą datę końca"
                  className={iconBtn}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => handleDelete(lead.id)}
                title="Usuń"
                className="text-[#5d6050] hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!ended && (
            <button
              type="button"
              onClick={() => handleChangeDose(lead)}
              className="mt-2 rounded-lg border border-[#2e3229] px-2.5 py-1 text-[10px] font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
            >
              Zmień dawkę
            </button>
          )}

          {history.length > 0 && (
            <div className="mt-2 border-t border-[#2e3229] pt-2">
              <button
                type="button"
                onClick={() => toggleHistory(group.key)}
                className="flex items-center gap-1 text-[10px] font-bold text-[#5d6050] hover:text-[#8c9282] transition-colors"
              >
                {historyOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Historia dawek ({history.length})
              </button>
              {historyOpen && (
                <ul className="mt-1.5 space-y-1">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between gap-3 text-[11px] text-[#8c9282]"
                    >
                      <span className="truncate">
                        {h.dose ?? "bez dawki"}
                        {h.frequency ? ` · ${h.frequency}` : ""} — {fmt(h.startDate)}
                        {h.endDate ? ` → ${fmt(h.endDate)}` : ""}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEdit(h)} title="Edytuj" className={iconBtn}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
                          title="Usuń"
                          className="text-[#5d6050] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-[#1a1c18] border border-[#2e3229] rounded-xl p-4 md:p-6 space-y-4">
        {activeGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d6050]">
              Aktywne ({activeGroups.length})
            </p>
            {activeGroups.map((g) => renderGroup(g, false))}
          </div>
        )}

        {endedGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d6050]">
              Zakończone ({endedGroups.length})
            </p>
            {endedGroups.map((g) => renderGroup(g, true))}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 rounded-xl border border-[#2e3229] bg-[#141511]"
          >
            <p className="text-xs font-bold text-[#f1f2ec]">
              {editId ? "Edytuj lek" : "Nowy lek"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input required type="text" placeholder="Nazwa leku *" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              </div>
              <input type="text" placeholder="Dawka (np. 500 mg)" value={dose} onChange={(e) => setDose(e.target.value)}
                className="h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              <input type="text" placeholder="Częstotliwość (np. 2x dziennie)" value={frequency} onChange={(e) => setFrequency(e.target.value)}
                className="h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              <div className="space-y-1">
                <label className="text-xs text-[#8c9282]">Od</label>
                <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#8c9282]">Do (opcjonalnie)</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              </div>
              {dictionaries && (
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-[#8c9282]">Leczenie (epizod)</label>
                  <select
                    value={episodeId}
                    onChange={(e) => setEpisodeId(e.target.value)}
                    className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                  >
                    <option value="">— brak —</option>
                    {dictionaries.episodes.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.title} ({episodeStatusMeta(ep.status).label})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <input type="text" placeholder="Notatki (opcjonalnie)" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-sm text-[#f1f2ec] focus:outline-none focus:border-[#bce663]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all disabled:opacity-50">
                {saving ? "Zapisuję…" : editId ? "Zapisz zmiany" : "Zapisz lek"}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 rounded-xl border border-[#2e3229] text-xs font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all">
                Anuluj
              </button>
              {result && <span className="text-xs text-[#8c9282]">{result}</span>}
            </div>
          </form>
        )}
      </div>
    );
  }
);
