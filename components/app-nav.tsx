"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Dumbbell,
  Footprints,
  PersonStanding,
  Heart,
  Settings,
  LogOut,
  ChevronDown,
  Activity,
  Bot,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/strength", label: "Siła", icon: Dumbbell },
  { href: "/bieg", label: "Bieg", icon: Footprints },
  { href: "/cialo", label: "Ciało", icon: PersonStanding },
  { href: "/zdrowie", label: "Zdrowie", icon: Heart },
  { href: "/calendar", label: "Kalendarz", icon: CalendarDays },
  { href: "/asystent", label: "Asystent", icon: Bot },
  { href: "/settings", label: "Ustawienia", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<{ type: string; lastSyncedAt: string | null; isActive: boolean }[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then(res => res.json())
      .then(data => {
        if (data.dataSources) {
          const active = data.dataSources.filter((ds: any) => ds.isActive);
          setIntegrations(data.dataSources);
          setActiveCount(active.length);
        }
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#profile-dropdown-container")) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isDropdownOpen]);

  const userName = session?.user?.name || "Użytkownik";
  const userEmail = session?.user?.email || "";
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  function formatSyncTime(timeStr: string | null) {
    if (!timeStr) return "brak";
    const date = new Date(timeStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const time = date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `${time}`;
    if (isYesterday) return `wczoraj ${time}`;
    return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) + ` ${time}`;
  }

  return (
    <nav className="flex flex-col h-full bg-[#0d0e0c] border-r border-[#1a1c18] text-white select-none">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1a1c18]">
        <div className="w-8 h-8 rounded-lg bg-[#bce663] flex items-center justify-center font-bold text-black text-lg">
          h
        </div>
        <div>
          <span className="text-base font-bold text-white tracking-tight block">HealthOS</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">v0.7 · alpha</span>
        </div>
      </div>

      {/* Nawigacja */}
      <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">Sekcje</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                active
                  ? "bg-[#1a1c18] text-[#bce663]"
                  : "text-muted-foreground hover:text-white hover:bg-[#1a1c18]/50"
              )}
            >
              {active && (
                <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded bg-[#bce663]" />
              )}
              <Icon className={cn("h-4 w-4 shrink-0 transition-colors group-hover:text-white", active && "text-[#bce663]")} />
              <span>{label}</span>
              {label === "Dashboard" && (
                <span className="ml-auto w-5 h-5 rounded-full bg-[#1a1c18] border border-[#2a2c28] text-[#bce663] text-[11px] font-bold flex items-center justify-center">
                  4
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Integracje i Profil */}
      <div className="p-4 border-t border-[#1a1c18] space-y-4">
        {/* Panel Integracji */}
        {activeCount > 0 && (
          <div className="border border-[#1a1c18] bg-[#0d0e0c]/50 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center text-muted-foreground font-semibold uppercase tracking-wider text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
              {activeCount} {activeCount === 1 ? "integracja aktywna" : activeCount < 5 ? "integracje aktywne" : "integracji aktywnych"}
            </div>
            <div className="space-y-1 text-muted-foreground">
              {integrations.map((ds) => {
                const name = ds.type === "STRAVA" ? "Strava" : ds.type === "HEVY" ? "Hevy" : ds.type === "COLMI" ? "Colmi Ring" : ds.type;
                if (!ds.isActive) return null;
                return (
                  <div key={ds.type} className="flex justify-between items-center text-[11px]">
                    <span>{name}</span>
                    <span className="text-[10px] text-muted-foreground/60">{formatSyncTime(ds.lastSyncedAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Profil Użytkownika */}
        <div 
          id="profile-dropdown-container"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="relative flex items-center justify-between p-2 rounded-xl bg-[#121310] hover:bg-[#1a1c18] border border-[#1a1c18] transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#1a1c18] border border-[#2a2c28] text-white flex items-center justify-center font-bold text-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", isDropdownOpen && "rotate-180")} />

          {/* Szybki wyloguj w hover/click (dropdown lub prosty tooltip) */}
          <div 
            className={cn(
              "absolute bottom-full left-0 right-0 mb-2 p-1 bg-[#121310] border border-[#1a1c18] rounded-xl shadow-xl transition-all duration-200 z-50",
              isDropdownOpen 
                ? "opacity-100 translate-y-0 pointer-events-auto" 
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Wyloguj
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

