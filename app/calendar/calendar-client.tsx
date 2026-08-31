"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { pl } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  User,
  Activity,
  FileText,
  List,
  LayoutGrid,
} from "lucide-react";
import {
  AGENDA_KIND_LABEL,
  daysFromToday,
  type AgendaItem,
  type AgendaKind,
} from "@/lib/constants/agenda";

/** Kolor per rodzaj — ta sama paleta co w panelu i na kartach. */
const KIND_STYLE: Record<AgendaKind, { dot: string; text: string; icon: typeof User }> = {
  EXAM: { dot: "bg-[#4dc9f6]", text: "text-[#4dc9f6]", icon: FlaskConical },
  VISIT: { dot: "bg-[#bce663]", text: "text-[#bce663]", icon: User },
  FOLLOW_UP: { dot: "bg-amber-400", text: "text-amber-300", icon: Activity },
  REFERRAL_EXPIRY: { dot: "bg-rose-400", text: "text-rose-300", icon: FileText },
  DENTAL: { dot: "bg-violet-400", text: "text-violet-300", icon: Activity },
};

interface EpisodeOption {
  id: string;
  title: string;
}

interface Props {
  year: number;
  month: number; // 1–12
  items: AgendaItem[];
  /** Pozycje bez terminu — nie mają gdzie wylądować w siatce, więc są pod nią. */
  undated: AgendaItem[];
  episodes: EpisodeOption[];
}

/**
 * Widok kalendarza (poz. 9 etap 2).
 *
 * Siatka miesiąca liczona z `date-fns`, bez zewnętrznej biblioteki kalendarza —
 * zdarzeń jest kilka na miesiąc, więc 200 kB zależności dla jednego widoku
 * się nie broni. Widoki: miesiąc i lista; tydzień/dzień są zbędne, bo to nie
 * jest kalendarz spotkań.
 */
export function CalendarClient({ year, month, items, undated, episodes }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "list">("month");
  const [episodeFilter, setEpisodeFilter] = useState<string>("ALL");

  const cursor = new Date(year, month - 1, 1);

  const shown = useMemo(() => {
    if (episodeFilter === "ALL") return items;
    if (episodeFilter === "NONE") return items.filter((i) => !i.episodeId);
    return items.filter((i) => i.episodeId === episodeFilter);
  }, [items, episodeFilter]);

  const shownUndated = useMemo(() => {
    if (episodeFilter === "ALL") return undated;
    if (episodeFilter === "NONE") return undated.filter((i) => !i.episodeId);
    return undated.filter((i) => i.episodeId === episodeFilter);
  }, [undated, episodeFilter]);

  /** Dni siatki: pełne tygodnie obejmujące miesiąc (poniedziałek jako pierwszy). */
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [year, month]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const i of shown) {
      if (!i.date) continue;
      const key = format(new Date(i.date), "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    }
    return map;
  }, [shown]);

  function go(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  function openItem(item: AgendaItem) {
    // Drill-down części ciała żyje w /zdrowie — otwieramy go parametrem.
    router.push(item.bodyPartId ? `/zdrowie?bodyPart=${item.bodyPartId}` : "/zdrowie");
  }

  const renderChip = (item: AgendaItem) => {
    const style = KIND_STYLE[item.kind];
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => openItem(item)}
        title={`${AGENDA_KIND_LABEL[item.kind]}: ${item.title}`}
        className="w-full flex items-center gap-1 text-left rounded px-1 py-0.5 hover:bg-[#2e3229] transition-colors"
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
        <span
          className={`truncate text-[10px] ${
            item.overdue ? "text-rose-300 font-bold" : "text-[#f1f2ec]"
          }`}
        >
          {item.title}
        </span>
      </button>
    );
  };

  const renderListRow = (item: AgendaItem) => {
    const style = KIND_STYLE[item.kind];
    const Icon = style.icon;
    const days = daysFromToday(item.date);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => openItem(item)}
        className="w-full text-left flex items-start gap-2.5 rounded-lg border border-[#2e3229] bg-[#1a1c18] px-3 py-2.5 hover:border-[#bce663]/40 transition-all"
      >
        {item.overdue ? (
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.text}`} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5d6050]">
              {AGENDA_KIND_LABEL[item.kind]}
            </span>
            <span
              className={`text-xs font-semibold ${
                item.overdue ? "text-rose-300" : "text-[#f1f2ec]"
              }`}
            >
              {item.title}
            </span>
          </span>
          <span className="block text-[11px] font-mono mt-0.5 text-[#8c9282]">
            {item.date ? format(new Date(item.date), "dd.MM.yyyy") : "termin nieustalony"}
            {days !== null && (
              <span className={item.overdue ? "text-rose-400 font-bold" : ""}>
                {" · "}
                {days === 0
                  ? "dziś"
                  : days < 0
                  ? `${Math.abs(days)} dni temu`
                  : `za ${days} dni`}
              </span>
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
    );
  };

  return (
    <div className="space-y-4">
      {/* Nagłówek: nawigacja po miesiącach + przełącznik widoku */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="rounded-lg border border-[#2e3229] p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
            title="Poprzedni miesiąc"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-[#f1f2ec] min-w-[150px] text-center capitalize">
            {format(cursor, "LLLL yyyy", { locale: pl })}
          </span>
          <button
            onClick={() => go(1)}
            className="rounded-lg border border-[#2e3229] p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
            title="Następny miesiąc"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href="/calendar"
            className="rounded-lg border border-[#2e3229] px-2.5 py-1.5 text-[10px] font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
          >
            Dziś
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {episodes.length > 0 && (
            <select
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className="rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-2.5 py-1.5 outline-none focus:border-[#bce663]/50"
            >
              <option value="ALL">Wszystkie leczenia</option>
              <option value="NONE">— bez leczenia —</option>
              {episodes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-[#1a1c18] p-1 rounded-lg border border-[#2e3229]">
            {(
              [
                ["month", "Miesiąc", LayoutGrid],
                ["list", "Lista", List],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  view === key
                    ? "bg-[#bce663] text-[#0d0e0c]"
                    : "text-[#8c9282] hover:text-[#f1f2ec]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" ? (
        <div className="rounded-xl border border-[#2e3229] bg-[#1a1c18] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            {["pon", "wt", "śr", "czw", "pt", "sob", "ndz"].map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-[10px] uppercase font-bold tracking-wider text-[#5d6050] text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDay.get(key) ?? [];
              const outside = !isSameMonth(day, cursor);
              return (
                <div
                  key={key}
                  className={`min-h-[92px] border-b border-r border-[#2e3229] p-1.5 space-y-0.5 ${
                    outside ? "opacity-35" : ""
                  } ${isToday(day) ? "bg-[#bce663]/5" : ""}`}
                >
                  <div
                    className={`text-[10px] font-mono mb-1 ${
                      isToday(day)
                        ? "text-[#bce663] font-bold"
                        : "text-[#5d6050]"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  {dayItems.slice(0, 3).map(renderChip)}
                  {dayItems.length > 3 && (
                    <p className="text-[9px] text-[#5d6050] px-1">
                      +{dayItems.length - 3} więcej
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#2e3229] p-8 text-center text-xs text-[#8c9282]">
              Brak zdarzeń w tym miesiącu.
            </p>
          ) : (
            shown.map(renderListRow)
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-[10px] text-[#8c9282]">
        {(Object.keys(KIND_STYLE) as AgendaKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[k].dot}`} />
            {AGENDA_KIND_LABEL[k]}
          </span>
        ))}
      </div>

      {shownUndated.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
            Bez ustalonego terminu ({shownUndated.length})
          </p>
          {shownUndated.map(renderListRow)}
        </section>
      )}
    </div>
  );
}
