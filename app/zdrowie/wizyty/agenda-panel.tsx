"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  FlaskConical,
  User,
  Activity,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  AGENDA_KIND_LABEL,
  whenLabel,
  type AgendaItem,
  type AgendaKind,
  type AgendaBuckets,
} from "@/lib/constants/agenda";

const KIND_ICON: Record<AgendaKind, typeof Calendar> = {
  EXAM: FlaskConical,
  VISIT: User,
  FOLLOW_UP: Activity,
  REFERRAL_EXPIRY: FileText,
  DENTAL: Activity,
};

interface Props {
  agenda: AgendaBuckets;
  /** Kliknięcie w pozycję otwiera drill-down odpowiedniej części ciała. */
  onOpenBodyPart?: (bodyPartId: string) => void;
}

/**
 * Panel „co mam zrobić i kiedy" — najtańszy i najbardziej użyteczny kawałek
 * osi czasu (poz. 9 etap 1). Odpowiada na pytanie, które pacjent zadaje
 * najczęściej, a którego odpowiedź była dotąd rozsypana po czterech zakładkach.
 */
export function AgendaPanel({ agenda, onOpenBodyPart }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { overdue, upcoming, undated } = agenda;
  const total = overdue.length + upcoming.length + undated.length;

  if (total === 0) return null;

  const row = (item: AgendaItem, tone: "overdue" | "normal") => {
    const Icon = KIND_ICON[item.kind];
    const clickable = !!(item.bodyPartId && onOpenBodyPart);
    return (
      <li key={item.id}>
        <button
          type="button"
          disabled={!clickable}
          onClick={() => item.bodyPartId && onOpenBodyPart?.(item.bodyPartId)}
          className={`w-full text-left flex items-start gap-2 rounded-lg px-2.5 py-2 transition-all ${
            clickable ? "hover:bg-[#2e3229]/60 cursor-pointer" : "cursor-default"
          }`}
        >
          {tone === "overdue" ? (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Icon className="h-3.5 w-3.5 text-[#8c9282] shrink-0 mt-0.5" />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5d6050]">
                {AGENDA_KIND_LABEL[item.kind]}
              </span>
              <span
                className={`text-xs font-semibold ${
                  tone === "overdue" ? "text-rose-300" : "text-[#f1f2ec]"
                }`}
              >
                {item.title}
              </span>
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2 mt-0.5">
              <span
                className={`text-[11px] font-mono ${
                  tone === "overdue" ? "text-rose-400 font-bold" : "text-[#8c9282]"
                }`}
              >
                {item.date ? format(new Date(item.date), "dd.MM.yyyy") : "—"} ·{" "}
                {whenLabel(item)}
              </span>
              {item.detail && (
                <span className="text-[10px] text-[#5d6050]">{item.detail}</span>
              )}
            </span>
            {(item.bodyPartName || item.episodeTitle) && (
              <span className="block text-[10px] text-[#5d6050] mt-0.5">
                {item.bodyPartName ?? "bez części ciała"}
                {item.episodeTitle ? ` · ${item.episodeTitle}` : " · bez leczenia"}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="rounded-xl border border-[#2e3229] bg-[#1a1c18] overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2e3229] bg-[#0d0e0c]/30 hover:bg-[#0d0e0c]/50 transition-all"
      >
        <span className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-[#8c9282]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#8c9282]" />
          )}
          <Calendar className="h-4 w-4 text-[#bce663]" />
          <span className="text-sm font-bold text-[#f1f2ec]">Co Cię czeka</span>
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold">
          {overdue.length > 0 && (
            <span className="rounded-md px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/30">
              {overdue.length} zaległe
            </span>
          )}
          {upcoming.length > 0 && (
            <span className="rounded-md px-2 py-0.5 bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30">
              {upcoming.length} w 30 dni
            </span>
          )}
          {undated.length > 0 && (
            <span className="rounded-md px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {undated.length} bez terminu
            </span>
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-4">
          {overdue.length > 0 && (
            <section>
              <p className="text-[10px] uppercase font-bold tracking-wider text-rose-400 px-2.5 mb-1">
                Zaległe ({overdue.length})
              </p>
              <ul className="space-y-0.5">{overdue.map((i) => row(i, "overdue"))}</ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#8c9282] px-2.5 mb-1">
                Nadchodzące (30 dni)
              </p>
              <ul className="space-y-0.5">{upcoming.map((i) => row(i, "normal"))}</ul>
            </section>
          )}

          {undated.length > 0 && (
            <section>
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-300 px-2.5 mb-1">
                Bez ustalonego terminu ({undated.length})
              </p>
              <ul className="space-y-0.5">{undated.map((i) => row(i, "normal"))}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
