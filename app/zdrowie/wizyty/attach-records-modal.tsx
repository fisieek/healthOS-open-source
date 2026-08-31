"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FlaskConical, User, Search, AlertCircle } from "lucide-react";
import { examTypeLabel, episodeStatusMeta, type DictEpisode } from "./constants";
import { visitDisplayDate } from "@/lib/services/visit-dates";

interface Row {
  id: string;
  kind: "exam" | "visit";
  title: string;
  subtitle: string;
  date: string | null;
  /** Nazwa części ciała, do której rekord należy dziś (null = nieprzypisany). */
  assignedTo: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bodyPartId: string;
  bodyPartName: string;
  /** Epizody tej części ciała — wybór celu podpięcia. */
  episodes: DictEpisode[];
  /** Epizod zaznaczony na starcie. */
  presetEpisodeId?: string;
  onSaved: () => void;
}

export function AttachRecordsModal({
  open,
  onClose,
  bodyPartId,
  bodyPartName,
  episodes,
  presetEpisodeId,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [episodeId, setEpisodeId] = useState(presetEpisodeId ?? "");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dane bierzemy z istniejących endpointów listujących — bez nowej trasy API.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingList(true);
    setError(null);

    Promise.all([
      fetch("/api/health/documents").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/health/visits").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([docs, visits]) => {
        if (cancelled) return;
        const examRows: Row[] = (docs as any[]).map((d) => ({
          id: d.id,
          kind: "exam" as const,
          title: d.title,
          subtitle: examTypeLabel(d.type),
          date: d.status === "PLANNED" ? d.plannedDate : d.studyDate,
          assignedTo: d.bodyPart?.name ?? null,
        }));
        const visitRows: Row[] = (visits as any[]).map((v) => ({
          id: v.id,
          kind: "visit" as const,
          title: v.doctorName || "Wizyta",
          subtitle: v.specialization || "",
          date: visitDisplayDate(v)?.toISOString() ?? null,
          assignedTo: v.bodyPart?.name ?? null,
        }));
        setRows([...examRows, ...visitRows]);
      })
      .catch(() => {
        if (!cancelled) setError("Nie udało się pobrać listy rekordów.");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Nieprzypisane na górze — to one są zwykle powodem otwarcia tego okna.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.subtitle.toLowerCase().includes(q)
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const aFree = a.assignedTo === null ? 0 : 1;
      const bFree = b.assignedTo === null ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      return (b.date ?? "").localeCompare(a.date ?? "");
    });
  }, [rows, query]);

  const unassignedCount = rows.filter((r) => r.assignedTo === null).length;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);

    const payload = { bodyPartId, episodeId: episodeId || null };
    const targets = rows.filter((r) => selected.has(`${r.kind}:${r.id}`));

    try {
      const results = await Promise.all(
        targets.map((r) =>
          fetch(
            r.kind === "exam"
              ? `/api/health/documents/${r.id}`
              : `/api/health/visits/${r.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          )
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(
          `Nie udało się podpiąć ${failed} z ${targets.length} rekordów. Pozostałe zostały zapisane.`
        );
        onSaved();
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Podepnij istniejące"
      description={`Przypisz już zapisane badania i wizyty do „${bodyPartName}". Rekordy nie są kopiowane — zmienia się tylko ich przypisanie.`}
      size="3xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Szukaj</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5d6050]" />
              <Input
                type="text"
                placeholder="nazwa badania, lekarz..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs pl-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Podepnij do leczenia</Label>
            <select
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50"
            >
              <option value="">— tylko część ciała, bez leczenia —</option>
              {episodes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({episodeStatusMeta(e.status).label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {unassignedCount > 0 && (
          <p className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {unassignedCount}{" "}
            {unassignedCount === 1 ? "rekord nie ma" : "rekordów nie ma"} jeszcze
            żadnej części ciała — są na górze listy.
          </p>
        )}

        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-[#2e3229] bg-[#1a1c18] divide-y divide-[#2e3229]/60">
          {loadingList ? (
            <p className="p-6 text-center text-xs text-[#8c9282]">Wczytywanie...</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-xs text-[#8c9282]">
              Brak rekordów do wyświetlenia.
            </p>
          ) : (
            visible.map((r) => {
              const key = `${r.kind}:${r.id}`;
              const checked = selected.has(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    checked ? "bg-[#bce663]/5" : "hover:bg-[#0d0e0c]/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="h-3.5 w-3.5 accent-[#bce663] shrink-0"
                  />
                  {r.kind === "exam" ? (
                    <FlaskConical className="h-3.5 w-3.5 text-[#bce663] shrink-0" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-[#4dc9f6] shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[#f1f2ec] truncate">
                      {r.title}
                    </span>
                    <span className="block text-[10px] text-[#8c9282]">
                      {r.subtitle}
                      {r.date
                        ? ` · ${format(new Date(r.date), "dd.MM.yyyy")}`
                        : " · bez terminu"}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-mono shrink-0 ${
                      r.assignedTo ? "text-[#5d6050]" : "text-amber-300"
                    }`}
                  >
                    {r.assignedTo ?? "nieprzypisane"}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || selected.size === 0}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs disabled:opacity-40"
          >
            {saving
              ? "Podpinanie..."
              : `Podepnij zaznaczone (${selected.size})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
