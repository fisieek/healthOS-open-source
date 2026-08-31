"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Pencil, RefreshCw, Check, X, Footprints, Bike, Waves, Dumbbell, Sparkles,
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";

// ─── Types (mirror server) ────────────────────────────────────────────────────

export type PlanType = "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER";
export type PlanStatus = "PLANNED" | "DONE" | "PARTIALLY_DONE" | "MISSED";

export interface PlanSession {
  id: string;
  date: string; // ISO
  type: PlanType;
  name: string;
  targetDistance: number | null;
  targetDuration: number | null;
  targetVolume: number | null;
  notes: string | null;
  statuses: {
    id: string;
    status: PlanStatus;
    matchScore: number | null;
    overriddenAt: string | null;
    activity: { id: string; name: string; distance: number | null; duration: number; type: PlanType } | null;
    strengthWorkout: { id: string; name: string; volume: number | null; duration: number | null } | null;
  }[];
}

interface Props {
  sessions: PlanSession[];
  weekStart: string; // ISO YYYY-MM-DD
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PlanType, string> = {
  RUN: "Bieg",
  RIDE: "Rower",
  SWIM: "Pływanie",
  STRENGTH: "Siła",
  OTHER: "Inne",
};

const TYPE_ICONS: Record<PlanType, React.ComponentType<{ className?: string }>> = {
  RUN: Footprints,
  RIDE: Bike,
  SWIM: Waves,
  STRENGTH: Dumbbell,
  OTHER: Sparkles,
};

const TYPE_COLORS: Record<PlanType, string> = {
  RUN: "text-green-500",
  RIDE: "text-blue-500",
  SWIM: "text-cyan-500",
  STRENGTH: "text-purple-500",
  OTHER: "text-gray-500",
};

const STATUS_LABEL: Record<PlanStatus, string> = {
  PLANNED: "Plan",
  DONE: "Zrobione",
  PARTIALLY_DONE: "Częściowo",
  MISSED: "Nie zrobione",
};

const STATUS_COLOR: Record<PlanStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  DONE: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  PARTIALLY_DONE: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  MISSED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
  return `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

function getStatus(s: PlanSession): PlanStatus {
  return s.statuses[0]?.status ?? "PLANNED";
}

// ─── Add/Edit form ────────────────────────────────────────────────────────────

interface FormState {
  type: PlanType;
  name: string;
  date: string;
  targetDistance: string; // km input
  targetDuration: string; // minutes input
  targetVolume: string; // tonnes input (kg / 1000)
  notes: string;
}

function emptyForm(date: string): FormState {
  return {
    type: "RUN",
    name: "",
    date,
    targetDistance: "",
    targetDuration: "",
    targetVolume: "",
    notes: "",
  };
}

function fromSession(s: PlanSession): FormState {
  return {
    type: s.type,
    name: s.name,
    date: s.date.slice(0, 10),
    targetDistance: s.targetDistance ? String(s.targetDistance / 1000) : "",
    targetDuration: s.targetDuration ? String(Math.round(s.targetDuration / 60)) : "",
    targetVolume: s.targetVolume ? String(s.targetVolume) : "",
    notes: s.notes ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    type: form.type,
    name: form.name.trim(),
    date: form.date,
    targetDistance: form.targetDistance ? Number(form.targetDistance) * 1000 : null,
    targetDuration: form.targetDuration ? Number(form.targetDuration) * 60 : null,
    targetVolume: form.targetVolume ? Number(form.targetVolume) : null,
    notes: form.notes || null,
  };
}

function PlanForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSubmit: (form: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const isEnduro = form.type !== "STRENGTH";

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) onSubmit(form); }}
      className="space-y-2 p-3 bg-muted/40 rounded-md border border-border"
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value as PlanType)}
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {(Object.keys(TYPE_LABELS) as PlanType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => set("date", e.target.value)}
          required
          className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          required
          placeholder="Nazwa (np. Easy run, Push day)"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {isEnduro && (
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Dystans (km)"
            value={form.targetDistance}
            onChange={(e) => set("targetDistance", e.target.value)}
            className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}
        <input
          type="number"
          step="1"
          min="0"
          placeholder="Czas (min)"
          value={form.targetDuration}
          onChange={(e) => set("targetDuration", e.target.value)}
          className={`${isEnduro ? "" : "col-span-1"} h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring`}
        />
        {!isEnduro && (
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Tonaż (kg)"
            value={form.targetVolume}
            onChange={(e) => set("targetVolume", e.target.value)}
            className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}
        <input
          type="text"
          placeholder="Notatki"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || !form.name.trim()}>
          {saving ? "Zapisuję…" : "Zapisz"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Anuluj
        </Button>
      </div>
    </form>
  );
}

// ─── Single plan row ──────────────────────────────────────────────────────────

function PlanRow({
  session,
  onEdited,
  onDeleted,
  onStatusOverride,
}: {
  session: PlanSession;
  onEdited: (s: PlanSession) => void;
  onDeleted: (id: string) => void;
  onStatusOverride: (id: string, status: PlanStatus) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const status = getStatus(session);
  const Icon = TYPE_ICONS[session.type];
  const linked = session.statuses[0]?.activity ?? session.statuses[0]?.strengthWorkout;
  const isOverridden = !!session.statuses[0]?.overriddenAt;

  async function handleEdit(form: FormState) {
    setSaving(true);
    try {
      const res = await fetch(`/api/plan/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (res.ok) {
        const updated = await res.json();
        onEdited(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Usunąć "${session.name}"?`)) return;
    const res = await fetch(`/api/plan/${session.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(session.id);
  }

  if (editing) {
    return (
      <PlanForm
        initial={fromSession(session)}
        onSubmit={handleEdit}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <div className="group flex items-start gap-2 p-2 rounded-md border border-border bg-background hover:bg-accent/30 transition-colors">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${TYPE_COLORS[session.type]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{session.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
            {isOverridden && " ✋"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span>{TYPE_LABELS[session.type]}</span>
          {session.targetDistance && <span>· {formatDistance(session.targetDistance)}</span>}
          {session.targetDuration && <span>· {formatDuration(session.targetDuration)}</span>}
          {session.targetVolume && <span>· {Math.round(session.targetVolume)} kg</span>}
        </div>
        {linked && (
          <div className="text-xs text-muted-foreground mt-0.5 italic truncate">
            ↳ {linked.name}
          </div>
        )}
        {session.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">{session.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Quick status overrides */}
        {status !== "DONE" && (
          <button
            onClick={() => onStatusOverride(session.id, "DONE")}
            title="Oznacz jako zrobione"
            className="text-muted-foreground hover:text-green-500 p-1"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        {status !== "MISSED" && status !== "PLANNED" && (
          <button
            onClick={() => onStatusOverride(session.id, "MISSED")}
            title="Oznacz jako nie zrobione"
            className="text-muted-foreground hover:text-red-500 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          title="Edytuj"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          title="Usuń"
          className="text-muted-foreground hover:text-destructive p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  day,
  sessions,
  onAdd,
  onEdited,
  onDeleted,
  onStatusOverride,
}: {
  day: Date;
  sessions: PlanSession[];
  onAdd: (form: FormState) => Promise<void>;
  onEdited: (s: PlanSession) => void;
  onDeleted: (id: string) => void;
  onStatusOverride: (id: string, status: PlanStatus) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = isToday(day);
  const past = isBefore(startOfDay(day), startOfDay(new Date()));
  const dayIso = format(day, "yyyy-MM-dd");

  async function handleAdd(form: FormState) {
    setSaving(true);
    try {
      await onAdd(form);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`p-3 ${past ? "bg-muted/20" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${today ? "text-primary" : "text-muted-foreground"}`}>
            {format(day, "EEEE", { locale: pl })}
          </p>
          <p className={`text-lg font-semibold ${today ? "text-primary" : ""}`}>
            {format(day, "d MMM", { locale: pl })}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            title="Dodaj sesję"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sessions.map((s) => (
          <PlanRow
            key={s.id}
            session={s}
            onEdited={onEdited}
            onDeleted={onDeleted}
            onStatusOverride={onStatusOverride}
          />
        ))}
        {adding && (
          <PlanForm
            initial={emptyForm(dayIso)}
            onSubmit={handleAdd}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        )}
        {sessions.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground/60 italic py-2">Dzień wolny</p>
        )}
      </div>
    </div>
  );
}

// ─── Main manager ─────────────────────────────────────────────────────────────

export function PlanManager({ sessions: initial, weekStart }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<PlanSession[]>(initial);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = new Date(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  function sessionsForDay(day: Date): PlanSession[] {
    return sessions
      .filter((s) => isSameDay(new Date(s.date), day))
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  async function handleAdd(form: FormState) {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(form)),
    });
    if (res.ok) {
      const created = await res.json();
      setSessions((prev) => [...prev, { ...created, statuses: [] }]);
      startTransition(() => router.refresh());
    }
  }

  function handleEdited(updated: PlanSession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    startTransition(() => router.refresh());
  }

  function handleDeleted(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    startTransition(() => router.refresh());
  }

  async function handleStatusOverride(id: string, status: PlanStatus) {
    const res = await fetch(`/api/plan/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      startTransition(() => router.refresh());
    }
  }

  async function handleMatchAll() {
    setMatching(true);
    setMatchResult(null);
    try {
      const res = await fetch("/api/plan/match", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMatchResult(`✓ Zaktualizowano ${data.updated}/${data.processed}`);
        startTransition(() => router.refresh());
      } else {
        setMatchResult(`✗ ${data.error}`);
      }
    } catch {
      setMatchResult("✗ Błąd");
    } finally {
      setMatching(false);
      setTimeout(() => setMatchResult(null), 4000);
    }
  }

  // Week navigation
  const prevWeek = format(addDays(start, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(start, 7), "yyyy-MM-dd");
  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <a
            href={`/plan?week=${prevWeek}`}
            className="text-sm h-8 px-2.5 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
          >
            ← Poprzedni
          </a>
          <a
            href={`/plan?week=${thisWeek}`}
            className="text-sm h-8 px-2.5 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
          >
            Bieżący
          </a>
          <a
            href={`/plan?week=${nextWeek}`}
            className="text-sm h-8 px-2.5 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
          >
            Następny →
          </a>
        </div>
        <div className="flex items-center gap-2">
          {matchResult && (
            <span className="text-xs text-muted-foreground">{matchResult}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleMatchAll}
            disabled={matching || pending}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${matching ? "animate-spin" : ""}`} />
            Dopasuj plan
          </Button>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-border">
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              sessions={sessionsForDay(day)}
              onAdd={handleAdd}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              onStatusOverride={handleStatusOverride}
            />
          ))}
        </div>
      </div>

      {/* Quick legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Statusy:</span>
        {(["PLANNED", "DONE", "PARTIALLY_DONE", "MISSED"] as PlanStatus[]).map((s) => (
          <Badge key={s} variant="outline" className={`text-[10px] ${STATUS_COLOR[s]}`}>
            {STATUS_LABEL[s]}
          </Badge>
        ))}
        <span className="ml-auto">✋ = ręczna korekta</span>
      </div>
    </div>
  );
}
