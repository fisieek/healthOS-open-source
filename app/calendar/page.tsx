import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { endOfMonth, startOfMonth } from "date-fns";
import { getAgendaItems } from "@/lib/services/health-agenda";
import { listDictionaries } from "@/lib/services/medical-dictionaries";
import { CalendarClient } from "./calendar-client";

/**
 * Kalendarz zdrowia (poz. 9 etap 2).
 *
 * Do tej pory ta trasa była atrapą (`redirect("/")`). Teraz pokazuje agendę —
 * to samo źródło, co panel „Co Cię czeka", tylko rozłożone na siatkę miesiąca.
 *
 * Miesiąc przychodzi w query stringu, więc widok jest w całości serwerowy
 * i da się podlinkować konkretny miesiąc.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const now = new Date();
  const yearRaw = Number(sp.year);
  const monthRaw = Number(sp.month);
  const year = Number.isInteger(yearRaw) && yearRaw > 1900 ? yearRaw : now.getFullYear();
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.getMonth() + 1;

  const cursor = new Date(year, month - 1, 1);

  const [items, undated, dictionaries] = await Promise.all([
    getAgendaItems(session.user.id, {
      from: startOfMonth(cursor),
      to: endOfMonth(cursor),
    }),
    // Pozycje bez terminu nie należą do żadnego miesiąca — pokazujemy je pod siatką.
    getAgendaItems(session.user.id, { onlyUndated: true }),
    listDictionaries(session.user.id),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-[#bce663]" />
        <div>
          <h1 className="text-2xl font-bold text-[#f1f2ec]">Kalendarz</h1>
          <p className="text-sm text-[#8c9282] mt-0.5">
            Badania, wizyty, kontrole, zabiegi i ważność skierowań w jednym miejscu.
          </p>
        </div>
      </div>

      <CalendarClient
        year={year}
        month={month}
        items={items}
        undated={undated}
        episodes={dictionaries.episodes.map((e) => ({ id: e.id, title: e.title }))}
      />
    </div>
  );
}
