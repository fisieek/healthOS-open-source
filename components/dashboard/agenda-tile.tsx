"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Calendar, ChevronRight } from "lucide-react";
import {
  AGENDA_KIND_LABEL,
  whenLabel,
  type AgendaBuckets,
  type AgendaItem,
} from "@/lib/constants/agenda";

interface Props {
  agenda: AgendaBuckets;
  /** Ile pozycji pokazać na kafelku; reszta chowa się za „zobacz wszystkie". */
  limit?: number;
}

/**
 * Kafelek „co Cię czeka" na Dashboardzie (poz. 9 etap 1).
 *
 * Zastępuje wcześniejszy alert o wygasających skierowaniach — agenda pokrywa
 * skierowania i cztery pozostałe źródła, więc trzymanie obu dublowałoby ten sam
 * wpis na jednym ekranie.
 */
export function AgendaTile({ agenda, limit = 4 }: Props) {
  const { overdue, upcoming, undated } = agenda;
  const total = overdue.length + upcoming.length + undated.length;
  if (total === 0) return null;

  // Zaległe zawsze pierwsze — to one wymagają reakcji.
  const shown = [...overdue, ...upcoming].slice(0, limit);
  const hidden = total - shown.length;

  return (
    <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#bce663]" />
          <span className="text-sm font-bold text-[#f1f2ec]">Co Cię czeka</span>
        </span>
        {overdue.length > 0 && (
          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            {overdue.length} zaległe
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {shown.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            {item.overdue ? (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[#bce663]/60 shrink-0 mt-1.5" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-[#f1f2ec] truncate">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#5d6050] mr-1.5">
                  {AGENDA_KIND_LABEL[item.kind]}
                </span>
                {item.title}
              </span>
              <span
                className={`block text-[10px] font-mono ${
                  item.overdue ? "text-rose-400 font-bold" : "text-[#8c9282]"
                }`}
              >
                {item.date ? format(new Date(item.date), "dd.MM.yyyy") : "—"} ·{" "}
                {whenLabel(item)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/zdrowie"
        className="flex items-center justify-between gap-2 rounded-xl border border-[#2b2d24] px-3 py-2 text-[11px] font-bold text-[#8c9282] hover:bg-[#2b2d24] hover:text-white transition-all"
      >
        <span>{hidden > 0 ? `Zobacz wszystkie (+${hidden})` : "Otwórz Zdrowie"}</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
