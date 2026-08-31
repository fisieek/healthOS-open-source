"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, X, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string | null;
  documentId: string | null;
  documentTitle: string | null;
}

interface DocumentOption {
  id: string;
  title: string;
  type: string;
}

interface Props {
  events: HealthEvent[];
  documents: DocumentOption[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  "BLOOD_TEST", "HORMONES_TEST", "IMAGING", "OTHER_TEST",
  "VACCINATION", "INJURY", "ILLNESS",
  "MEDICATION_START", "MEDICATION_END",
  "SUPPLEMENT_START", "SUPPLEMENT_END",
  "TRAINING_CYCLE_START", "TRAINING_CYCLE_END",
  "NOTE",
] as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  BLOOD_TEST: "Badanie krwi",
  HORMONES_TEST: "Hormony",
  IMAGING: "Obrazowanie",
  OTHER_TEST: "Inne badanie",
  VACCINATION: "Szczepienie",
  INJURY: "Uraz",
  ILLNESS: "Choroba",
  MEDICATION_START: "Lek – start",
  MEDICATION_END: "Lek – koniec",
  SUPPLEMENT_START: "Suplement – start",
  SUPPLEMENT_END: "Suplement – koniec",
  TRAINING_CYCLE_START: "Cykl treningowy – start",
  TRAINING_CYCLE_END: "Cykl treningowy – koniec",
  NOTE: "Notatka",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  BLOOD_TEST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  HORMONES_TEST: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IMAGING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  OTHER_TEST: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  VACCINATION: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  INJURY: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ILLNESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  MEDICATION_START: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  MEDICATION_END: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  SUPPLEMENT_START: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  SUPPLEMENT_END: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  TRAINING_CYCLE_START: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  TRAINING_CYCLE_END: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  NOTE: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

const DOT_COLORS: Record<string, string> = {
  BLOOD_TEST: "bg-red-500",
  HORMONES_TEST: "bg-orange-500",
  IMAGING: "bg-blue-500",
  OTHER_TEST: "bg-gray-500",
  VACCINATION: "bg-green-500",
  INJURY: "bg-red-600",
  ILLNESS: "bg-yellow-500",
  MEDICATION_START: "bg-purple-500",
  MEDICATION_END: "bg-purple-500",
  SUPPLEMENT_START: "bg-cyan-500",
  SUPPLEMENT_END: "bg-cyan-500",
  TRAINING_CYCLE_START: "bg-indigo-500",
  TRAINING_CYCLE_END: "bg-indigo-500",
  NOTE: "bg-gray-400",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineManager({ events, documents }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<string>("NOTE");
  const [formDate, setFormDate] = useState(todayIso());
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDocumentId, setFormDocumentId] = useState("");

  const filteredEvents = filter
    ? events.filter((e) => e.type === filter)
    : events;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);

    try {
      const res = await fetch("/api/health/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          date: formDate,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          documentId: formDocumentId || null,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormType("NOTE");
        setFormDate(todayIso());
        setFormTitle("");
        setFormDescription("");
        setFormDocumentId("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć to wydarzenie?")) return;
    const res = await fetch(`/api/health/events/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // Unique types present in events for filter buttons
  const presentTypes = [...new Set(events.map((e) => e.type))];

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "secondary" : "default"}
        >
          {showForm ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" /> Anuluj
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj wydarzenie
            </>
          )}
        </Button>
      </div>

      {/* Filter buttons */}
      {presentTypes.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              filter === null
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Wszystkie
          </button>
          {presentTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                filter === type
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {EVENT_TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      )}

      {/* Add event form */}
      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Typ
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Data
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tytuł
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="np. Morfologia krwi"
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Opis (opcjonalnie)
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm resize-none"
              />
            </div>

            {documents.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Powiązany dokument (opcjonalnie)
                </label>
                <select
                  value={formDocumentId}
                  onChange={(e) => setFormDocumentId(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">— brak —</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </form>
        </Card>
      )}

      <Separator />

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {events.length === 0
            ? "Brak wydarzeń. Dodaj pierwsze wydarzenie zdrowotne."
            : "Brak wydarzeń dla wybranego filtra."}
        </p>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative">
                {/* Dot */}
                <div
                  className={`absolute -left-6 top-3 h-[18px] w-[18px] rounded-full border-2 border-background ${
                    DOT_COLORS[event.type] || "bg-gray-400"
                  }`}
                />

                <Card className="p-3 ml-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            EVENT_TYPE_COLORS[event.type] || ""
                          }`}
                        >
                          {EVENT_TYPE_LABELS[event.type] || event.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.date), "d MMM yyyy", {
                            locale: pl,
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      {event.documentTitle && (
                        <a
                          href={`/health/documents`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                        >
                          <FileText className="h-3 w-3" />
                          {event.documentTitle}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                      title="Usuń"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
