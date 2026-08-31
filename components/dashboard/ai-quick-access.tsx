"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function AIQuickAccess() {
  return (
    <div className="border border-[#1a1c18] bg-[#0d0e0c]/50 rounded-2xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#bce663] animate-pulse" />
          Lokalni Agenci AI
        </h3>
        <span className="text-[10px] text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-2 py-0.5 rounded-full font-semibold">
          Beta
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Skonsultuj swoje dane zdrowotne lub treningowe z wyspecjalizowanymi asystentami.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Przycisk: Lekarz */}
        <Link
          href="/asystent?agent=doctor"
          className="group p-3 rounded-xl bg-[#10120f] border border-[#1a1c18] hover:border-[#bce663]/30 transition-all text-left flex flex-col justify-between h-[84px] cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#1a1c18] border border-[#2a2d26] flex items-center justify-center text-sm">
            🩺
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            <span className="text-[11px] font-bold text-white group-hover:text-[#bce663] transition-colors truncate">
              Lek(AI)rz POZ
            </span>
            <ArrowRight className="w-3 h-3 text-stone-600 group-hover:text-[#bce663] group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Przycisk: Trener */}
        <Link
          href="/asystent?agent=trainer"
          className="group p-3 rounded-xl bg-[#10120f] border border-[#1a1c18] hover:border-[#bce663]/30 transition-all text-left flex flex-col justify-between h-[84px] cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-[#1a1c18] border border-[#2a2d26] flex items-center justify-center text-sm">
            🏋️
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            <span className="text-[11px] font-bold text-white group-hover:text-[#bce663] transition-colors truncate">
              Trener Person(AI)lny
            </span>
            <ArrowRight className="w-3 h-3 text-stone-600 group-hover:text-[#bce663] group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>
    </div>
  );
}
