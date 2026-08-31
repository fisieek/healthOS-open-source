"use client";

import { Printer } from "lucide-react";

/** Drukowanie zostawiamy przeglądarce — `Cmd+P → Zapisz jako PDF` daje ten sam
 *  efekt co biblioteka PDF, bez dokładania kilkudziesięciu MB do paczki. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-[#bce663] px-4 py-2 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all"
    >
      <Printer className="h-3.5 w-3.5" />
      Drukuj / Zapisz PDF
    </button>
  );
}
