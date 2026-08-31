"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  prevYear: number;
  prevMonth: number;
  nextYear: number;
  nextMonth: number;
  currentYear: number;
  currentMonth: number;
}

export function CalendarNav({ prevYear, prevMonth, nextYear, nextMonth, currentYear, currentMonth }: Props) {
  const router = useRouter();

  function go(year: number, month: number) {
    router.push(`/calendar?year=${year}&month=${month}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => go(prevYear, prevMonth)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => go(currentYear, currentMonth)}
      >
        Dziś
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => go(nextYear, nextMonth)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
