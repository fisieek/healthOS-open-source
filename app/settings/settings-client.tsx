"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Footprints } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { isValidRunnaCalendarUrl, RUNNA_URL_HINT } from "@/lib/services/runna-url";
import { 
  Link as LinkIcon, 
  RefreshCw, 
  Heart, 
  BookOpen, 
  User as UserIcon, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { GeminiKeyForm } from "@/components/cialo/gemini-key-form";

interface SettingsClientProps {
  // Komponenty renderowane po stronie serwera / przekazane
  profileFormSection: React.ReactNode;
  stravaSection: React.ReactNode;
  hevySection: React.ReactNode;
  colmiSection: React.ReactNode;
  garminSection: React.ReactNode;
  syncButtonSection: React.ReactNode;
  /**
   * Ustawienia powiadomień desktopowych — `null` w przeglądarce.
   * Sekcja istnieje tylko wtedy, gdy apkę serwuje Electron (poz. 9 etap 3).
   */
  notificationsSection?: React.ReactNode;
  googleCalendarSection: React.ReactNode;
  
  // Dane surowe
  syncLogs: any[];
  nextCronStr: string;
  nextCronDist: string;
  initialSubtypes: any[];
  userProfile: any;

  // Runna
  initialRunnaUrl: string | null;
  initialRunnaLastSynced: string | null;
}

export function SettingsClient({
  profileFormSection,
  stravaSection,
  hevySection,
  colmiSection,
  garminSection,
  syncButtonSection,
  notificationsSection,
  googleCalendarSection,
  syncLogs,
  nextCronStr,
  nextCronDist,
  initialSubtypes,
  userProfile,
  initialRunnaUrl,
  initialRunnaLastSynced,
}: SettingsClientProps) {
  const [activeMenu, setActiveMenu] = useState<"integrations" | "sync" | "hr" | "dicts" | "biomarkers" | "reminders" | "profile">("integrations");
  const [subtypes, setSubtypes] = useState(initialSubtypes);
  
  // Formularz Słowników State
  const [parentType, setParentType] = useState("RUN");
  const [subtypeName, setSubtypeName] = useState("");
  const [dictLoading, setDictLoading] = useState(false);

  // Słownik biomarkerów state
  const [biomarkerName, setBiomarkerName] = useState("");
  const [biomarkerUnit, setBiomarkerUnit] = useState("");
  const [biomarkerNormMin, setBiomarkerNormMin] = useState("");
  const [biomarkerNormMax, setBiomarkerNormMax] = useState("");
  const [biomarkerCategory, setBiomarkerCategory] = useState("Morfologia");
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [biomarkerLoading, setBiomarkerLoading] = useState(false);

  // Przypomnienia cykliczne state
  const [reminders, setReminders] = useState<any[]>([]);
  const [reminderLoading, setReminderLoading] = useState(false);

  // Ładowanie biomarkerów na starcie
  useEffect(() => {
    async function loadBiomarkers() {
      try {
        const res = await fetch("/api/settings/biomarkers");
        if (res.ok) {
          const data = await res.json();
          setBiomarkers(data);
        }
      } catch (err) {
        console.error("Failed to load biomarkers", err);
      }
    }
    void loadBiomarkers();
  }, []);

  // Dodawanie podtypu aktywności
  const handleAddSubtype = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtypeName) return;
    setDictLoading(true);

    try {
      const res = await fetch("/api/settings/dictionaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentType,
          name: subtypeName,
          order: 0,
        }),
      });

      if (res.ok) {
        const newSubtype = await res.json();
        setSubtypes([...subtypes, newSubtype]);
        setSubtypeName("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDictLoading(false);
    }
  };

  // Usuwanie podtypu aktywności
  const handleDeleteSubtype = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten podtyp aktywności?")) return;
    try {
      const res = await fetch(`/api/settings/dictionaries?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubtypes(subtypes.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Wyliczanie stref tętna na podglądzie
  const getHeartRateZones = () => {
    const maxHr = userProfile?.maxHr ?? 190;
    const restHr = userProfile?.restingHr ?? 60;
    const lthr = userProfile?.lthr ?? 165;
    const method = userProfile?.zonesMethod ?? "PERCENT_MAX";

    if (method === "PERCENT_LTHR") {
      return [
        { name: "Z1: Recovery", range: `< ${Math.round(lthr * 0.85)} bpm`, desc: "Aktywna regeneracja", color: "bg-emerald-500" },
        { name: "Z2: Aerobic", range: `${Math.round(lthr * 0.85)} - ${Math.round(lthr * 0.89)} bpm`, desc: "Baza tlenowa", color: "bg-emerald-400" },
        { name: "Z3: Tempo", range: `${Math.round(lthr * 0.90)} - ${Math.round(lthr * 0.94)} bpm`, desc: "Tempo maratońskie", color: "bg-yellow-500" },
        { name: "Z4: Threshold", range: `${Math.round(lthr * 0.95)} - ${Math.round(lthr * 1.05)} bpm`, desc: "Próg mleczanowy", color: "bg-orange-500" },
        { name: "Z5: Anaerobic", range: `> ${Math.round(lthr * 1.05)} bpm`, desc: "Wydolność beztlenowa", color: "bg-red-500" },
      ];
    }

    if (method === "KARVONEN") {
      const hrr = maxHr - restHr;
      return [
        { name: "Z1: Recovery", range: `${Math.round(restHr + hrr * 0.50)} - ${Math.round(restHr + hrr * 0.59)} bpm`, desc: "Regeneracja", color: "bg-emerald-500" },
        { name: "Z2: Aerobic", range: `${Math.round(restHr + hrr * 0.60)} - ${Math.round(restHr + hrr * 0.69)} bpm`, desc: "Baza tlenowa", color: "bg-emerald-400" },
        { name: "Z3: Tempo", range: `${Math.round(restHr + hrr * 0.70)} - ${Math.round(restHr + hrr * 0.79)} bpm`, desc: "Tempo / Cardo", color: "bg-yellow-500" },
        { name: "Z4: Threshold", range: `${Math.round(restHr + hrr * 0.80)} - ${Math.round(restHr + hrr * 0.89)} bpm`, desc: "Próg tlenowy", color: "bg-orange-500" },
        { name: "Z5: Anaerobic", range: `> ${Math.round(restHr + hrr * 0.90)} bpm`, desc: "Maksymalny wysiłek", color: "bg-red-500" },
      ];
    }

    // PERCENT_MAX (Domyślny)
    return [
      { name: "Z1: Recovery", range: `${Math.round(maxHr * 0.50)} - ${Math.round(maxHr * 0.59)} bpm`, desc: "Aktywna regeneracja", color: "bg-emerald-500" },
      { name: "Z2: Aerobic", range: `${Math.round(maxHr * 0.60)} - ${Math.round(maxHr * 0.69)} bpm`, desc: "Baza / Spalanie tłuszczu", color: "bg-emerald-400" },
      { name: "Z3: Tempo", range: `${Math.round(maxHr * 0.70)} - ${Math.round(maxHr * 0.79)} bpm`, desc: "Wytrzymałość tlenowa", color: "bg-yellow-500" },
      { name: "Z4: Threshold", range: `${Math.round(maxHr * 0.80)} - ${Math.round(maxHr * 0.89)} bpm`, desc: "Próg przemian beztlenowych", color: "bg-orange-500" },
      { name: "Z5: Anaerobic", range: `> ${Math.round(maxHr * 0.90)} bpm`, desc: "Wysoka intensywność", color: "bg-red-500" },
    ];
  };

  const hrZones = getHeartRateZones();

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK — wzorzec globalny */}
      <div className="border-b border-[#2e3229] pb-5">
        <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Ustawienia</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#f1f2ec]">Ustawienia</h1>
        <p className="text-sm text-[#8c9282] mt-1">
          Integracje, synchronizacje, strefy tętna, słowniki i dane osobowe.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Lewy Sidebar Menu */}
        <div className="lg:col-span-1 space-y-1 bg-[#1a1c18] p-2 rounded-xl border border-[#2e3229] h-max">
          <button
            onClick={() => setActiveMenu("integrations")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "integrations"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <LinkIcon className="h-4 w-4" /> Integracje i Usługi
          </button>
          <button
            onClick={() => setActiveMenu("sync")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "sync"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <RefreshCw className="h-4 w-4" /> Synchronizacje i CRON
          </button>
          <button
            onClick={() => setActiveMenu("hr")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "hr"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <Heart className="h-4 w-4" /> Strefy Tętna
          </button>
          <button
            onClick={() => setActiveMenu("dicts")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "dicts"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Słowniki Aktywności
          </button>
          <button
            onClick={() => setActiveMenu("biomarkers")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "biomarkers"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Słownik Biomarkerów
          </button>
          <button
            onClick={() => setActiveMenu("reminders")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "reminders"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <Clock className="h-4 w-4" /> Przypomnienia Cykliczne
          </button>
          <button
            onClick={() => setActiveMenu("profile")}
            className={`w-full text-left px-4 py-3 text-xs font-bold rounded-lg transition-all flex items-center gap-2.5 ${
              activeMenu === "profile"
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec] hover:bg-[#2e3229]/20"
            }`}
          >
            <UserIcon className="h-4 w-4" /> Dane Osobowe i Cele
          </button>
        </div>

        {/* Prawy Kontener Sekcji */}
        <div className="lg:col-span-3">
          
          {/* 1. INTEGRACJE */}
          {activeMenu === "integrations" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Zintegrowane Aplikacje</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Zarządzaj aktywnymi integracjami zewnętrznymi. Dane importowane są automatycznie.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Strava */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    {stravaSection}
                  </div>

                  {/* Hevy */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    {hevySection}
                  </div>

                  {/* Colmi Ring */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    {colmiSection}
                  </div>

                  {/* Garmin Connect */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    {garminSection}
                  </div>
                  <div className="p-4 rounded-xl bg-[#141511] border border-[#2e3229]">
                    {googleCalendarSection}
                  </div>

                  {/* Runna */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    <RunnaSection
                      initialUrl={initialRunnaUrl}
                      initialLastSynced={initialRunnaLastSynced}
                    />
                  </div>

                  {/* Gemini AI */}
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl">
                    <GeminiKeyForm />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 2. SYNCHRONIZACJE I TASKI */}
          {activeMenu === "sync" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Harmonogram Synchronizacji CRON</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Automatyczne pobieranie danych i ich dopasowywanie do planów.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[#f1f2ec] font-semibold">
                      <Clock className="h-4 w-4 text-[#bce663]" />
                      <span>Codziennie o <span className="font-mono text-[#bce663]">03:00</span></span>
                    </div>
                    <p className="text-xs text-[#8c9282]">
                      Następne automatyczne odpalenie: {nextCronStr} (za {nextCronDist})
                    </p>
                    <p className="text-[11px] text-[#8c9282] border-t border-[#2e3229] pt-2 mt-2">
                      CRON synchronizuje dane ze Stravy oraz Hevy, a następnie optymalizuje powiązania w planie treningowym na dany dzień.
                    </p>
                  </div>

                  <div className="bg-[#0d0e0c] border border-[#2e3229] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#f1f2ec]">Wymuś synchronizację teraz</p>
                      <p className="text-xs text-[#8c9282] mt-0.5">Ręcznie uruchom pełne pobieranie Strava bez czekania do godziny 3:00.</p>
                    </div>
                    {syncButtonSection}
                  </div>
                </CardContent>
              </Card>

              {/* Logi */}
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Historia Ostatnich Synchronizacji</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Logi wykonania zadań automatycznych i manualnych.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {syncLogs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#8c9282]">
                      Brak historii. Uruchom pierwszą synchronizację.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2e3229]">
                      {syncLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3 p-3.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {log.status === "success" ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[#f1f2ec]">
                                  {log.dataSource?.type ?? log.triggeredBy.toUpperCase()}
                                </span>
                                <Badge className="bg-[#2e3229] text-[#8c9282] text-[9px] font-bold">
                                  {log.triggeredBy}
                                </Badge>
                                {log.status === "success" && log.itemsSynced != null && (
                                  <span className="text-[10px] text-[#8c9282]">
                                    Pobrano: {log.itemsSynced} {log.itemsSynced === 1 ? "element" : "elementów"}
                                  </span>
                                )}
                              </div>
                              {log.error && (
                                <p className="text-[11px] text-rose-400 truncate mt-0.5">{log.error}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#8c9282] shrink-0 font-mono">
                            {format(new Date(log.createdAt), "d MMM HH:mm", { locale: pl })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 3. STREFY TĘTNA */}
          {activeMenu === "hr" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Podgląd Twoich Stref Tętna</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Bieżące wyliczenie stref wydolnościowych na podstawie wybranej metody w profilu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-[#0d0e0c] p-4 rounded-xl border border-[#2e3229] space-y-1">
                    <p className="text-xs text-[#8c9282]">Aktualna metoda wyliczania:</p>
                    <p className="text-sm font-bold text-[#bce663] uppercase">
                      {userProfile?.zonesMethod === "PERCENT_LTHR" 
                        ? "Procent Progu Mleczanowego (LTHR)" 
                        : userProfile?.zonesMethod === "KARVONEN" 
                        ? "Metoda Karvonena (HRR)" 
                        : "Procent Tętna Maksymalnego (HRmax)"}
                    </p>
                    <div className="flex gap-4 pt-2 text-xs text-[#8c9282]">
                      <span>HRmax: <strong className="text-[#f1f2ec]">{userProfile?.maxHr ?? 190} bpm</strong></span>
                      {userProfile?.restingHr && <span>HRrest: <strong className="text-[#f1f2ec]">{userProfile.restingHr} bpm</strong></span>}
                      {userProfile?.lthr && <span>LTHR: <strong className="text-[#f1f2ec]">{userProfile.lthr} bpm</strong></span>}
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-2">
                    {hrZones.map((zone, idx) => (
                      <div key={zone.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-[#f1f2ec]">{zone.name}</span>
                          <span className="font-mono font-bold text-[#bce663]">{zone.range}</span>
                        </div>
                        <div className="relative h-2 bg-[#0d0e0c] rounded-full overflow-hidden border border-[#2e3229]">
                          <div className={`h-full ${zone.color}`} style={{ width: `${(idx + 1) * 20}%` }} />
                        </div>
                        <p className="text-[10px] text-[#8c9282]">{zone.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4. SŁOWNIKI */}
          {activeMenu === "dicts" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Zdefiniuj Podtypy Treningów</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Katalog podtypów aktywności służący do precyzyjnego planowania i kategoryzacji treningów.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Formularz dodawania */}
                  <form onSubmit={handleAddSubtype} className="bg-[#0d0e0c] p-4 rounded-xl border border-[#2e3229] flex flex-col md:flex-row md:items-end gap-3.5">
                    <div className="space-y-1.5 flex-1">
                      <Label htmlFor="parentType" className="text-xs text-[#8c9282]">Główna kategoria</Label>
                      <select
                        id="parentType"
                        value={parentType}
                        onChange={(e) => setParentType(e.target.value)}
                        className="w-full bg-[#1a1c18] border border-[#2e3229] rounded-lg text-xs p-2 text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
                      >
                        <option value="RUN">Bieg (RUN)</option>
                        <option value="STRENGTH">Siła (STRENGTH)</option>
                        <option value="RIDE">Rower (RIDE)</option>
                        <option value="OTHER">Inne (OTHER)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <Label htmlFor="subtypeName" className="text-xs text-[#8c9282]">Nazwa podtypu</Label>
                      <Input
                        id="subtypeName"
                        type="text"
                        placeholder="np. Interwały VO2max, FBW"
                        value={subtypeName}
                        onChange={(e) => setSubtypeName(e.target.value)}
                        className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={dictLoading}
                      className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
                    >
                      {dictLoading ? "Dodawanie..." : "Dodaj Podtyp"}
                    </Button>
                  </form>

                  {/* Lista podtypów */}
                  <div className="space-y-3">
                    {["RUN", "STRENGTH", "RIDE", "OTHER"].map((cat) => {
                      const items = subtypes.filter((s) => s.parentType === cat);
                      return (
                        <div key={cat} className="space-y-2">
                          <h4 className="text-xs font-bold text-[#8c9282] border-b border-[#2e3229] pb-1 uppercase tracking-wide">
                            {cat === "RUN" ? "Bieg" : cat === "STRENGTH" ? "Siła" : cat === "RIDE" ? "Rower" : "Inne"}
                          </h4>
                          {items.length === 0 ? (
                            <p className="text-[10px] text-[#8c9282] italic pl-2">Brak zdefiniowanych podtypów.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2 pl-2">
                              {items.map((item) => (
                                <Badge
                                  key={item.id}
                                  className="bg-[#0d0e0c] hover:bg-rose-500/10 border border-[#2e3229] text-[#f1f2ec] flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full transition-all group"
                                >
                                  {item.name}
                                  <button
                                    onClick={() => handleDeleteSubtype(item.id)}
                                    className="p-0.5 rounded-full hover:bg-rose-500/20 text-[#8c9282] hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                                    title="Usuń"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

          {/* 5. SŁOWNIK BIOMARKERÓW */}
          {activeMenu === "biomarkers" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Słownik Biomarkerów</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Zdefiniuj własne normy dla markerów krwi. Używane w zakładce "Badania Krwi" w sekcji Ciało.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!biomarkerName || !biomarkerUnit) return;
                      setBiomarkerLoading(true);
                      try {
                        const res = await fetch("/api/settings/biomarkers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: biomarkerName,
                            unit: biomarkerUnit,
                            normMin: biomarkerNormMin ? parseFloat(biomarkerNormMin) : null,
                            normMax: biomarkerNormMax ? parseFloat(biomarkerNormMax) : null,
                            category: biomarkerCategory,
                          }),
                        });
                        if (res.ok) {
                          const nb = await res.json();
                          setBiomarkers([...biomarkers, nb]);
                          setBiomarkerName(""); setBiomarkerUnit("");
                          setBiomarkerNormMin(""); setBiomarkerNormMax("");
                        }
                      } catch {}
                      setBiomarkerLoading(false);
                    }}
                    className="bg-[#0d0e0c] p-4 rounded-xl border border-[#2e3229] space-y-3"
                  >
                    <p className="text-xs font-bold text-[#8c9282] uppercase tracking-wider">Dodaj marker</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8c9282]">Nazwa markera</Label>
                        <Input value={biomarkerName} onChange={e => setBiomarkerName(e.target.value)}
                          placeholder="np. HGB, TSH, LDL" required
                          className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8c9282]">Jednostka</Label>
                        <Input value={biomarkerUnit} onChange={e => setBiomarkerUnit(e.target.value)}
                          placeholder="np. g/dl, mIU/l, mg/dl" required
                          className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8c9282]">Norma min</Label>
                        <Input type="number" step="0.01" value={biomarkerNormMin} onChange={e => setBiomarkerNormMin(e.target.value)}
                          placeholder="np. 12.0"
                          className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8c9282]">Norma max</Label>
                        <Input type="number" step="0.01" value={biomarkerNormMax} onChange={e => setBiomarkerNormMax(e.target.value)}
                          placeholder="np. 17.5"
                          className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs font-mono" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-[#8c9282]">Kategoria</Label>
                        <select value={biomarkerCategory} onChange={e => setBiomarkerCategory(e.target.value)}
                          className="w-full bg-[#1a1c18] border border-[#2e3229] rounded-lg text-xs p-2 text-[#f1f2ec] focus:outline-none focus:border-[#bce663]">
                          {["Morfologia","Mikroelementy","Witaminy","Hormony","Lipidogram","Metabolizm","Zapalne","Nerki","Wątroba","Inne"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button type="submit" disabled={biomarkerLoading}
                      className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs">
                      {biomarkerLoading ? "Dodawanie..." : "Dodaj Marker"}
                    </Button>
                  </form>

                  {biomarkers.length === 0 ? (
                    <p className="text-xs text-[#8c9282] italic text-center py-4">
                      Brak zdefiniowanych markerów. Normy są automatycznie wykrywane z wyników badań.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {biomarkers.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-[#2e3229] bg-[#0d0e0c]">
                          <div>
                            <p className="text-xs font-bold text-[#f1f2ec]">{b.name}</p>
                            <p className="text-[10px] text-[#8c9282]">
                              {b.normMin ?? "—"} – {b.normMax ?? "—"} {b.unit} · {b.category}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              await fetch(`/api/settings/biomarkers?id=${b.id}`, { method: "DELETE" });
                              setBiomarkers(biomarkers.filter((x: any) => x.id !== b.id));
                            }}
                            className="p-1.5 rounded-lg text-[#8c9282] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 6. PRZYPOMNIENIA CYKLICZNE */}
          {activeMenu === "reminders" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Przypomnienia Cykliczne</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Zarządzaj automatycznymi zadaniami pojawiającymi się w "Zadaniach na dziś". Zmiany obowiązują od dziś.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ReminderManager />
                </CardContent>
              </Card>

              {notificationsSection && (
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#f1f2ec]">Powiadomienia Systemowe</CardTitle>
                    <CardDescription className="text-xs text-[#8c9282]">
                      Dostępne tylko w aplikacji desktopowej. Nic nie wychodzi poza ten komputer.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {notificationsSection}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 7. DANE OSOBOWE */}
          {activeMenu === "profile" && (
            <div className="space-y-6">
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#f1f2ec]">Edytuj Dane Osobowe</CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    Zaktualizuj swoje parametry fizjologiczne oraz cele treningowe.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {profileFormSection}
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

// ─── ReminderManager ─────────────────────────────────────────────────────────

function ReminderManager() {
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const REMINDER_NAMES = [
    "Pomiar ciała i obwodów",
    "Badania krwi — przypomnienie",
  ];

  const FREQUENCY_OPTIONS = [
    { value: "DAILY", label: "Codziennie" },
    { value: "WEEKLY", label: "Co tydzień" },
    { value: "MONTHLY", label: "Co miesiąc" },
    { value: "YEARLY", label: "Co rok" },
  ];

  useEffect(() => {
    fetch("/api/habits?activeOnly=false")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHabits(data.filter((h: any) => REMINDER_NAMES.includes(h.name)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFrequencyChange = async (habit: any, newFrequency: string) => {
    setSaving(habit.id);
    try {
      const res = await fetch(`/api/habits/${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: newFrequency }),
      });
      if (res.ok) {
        const updated = await res.json();
        setHabits(prev => prev.map(h => h.id === habit.id ? updated : h));
      }
    } catch {}
    setSaving(null);
  };

  const handleToggle = async (habit: any) => {
    setSaving(habit.id);
    try {
      const res = await fetch(`/api/habits/${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !habit.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setHabits(prev => prev.map(h => h.id === habit.id ? updated : h));
      }
    } catch {}
    setSaving(null);
  };

  if (loading) {
    return <p className="text-xs text-[#8c9282] text-center py-6">Ładuję...</p>;
  }

  if (habits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#2e3229] p-6 text-center text-xs text-[#8c9282]">
        Brak skonfigurowanych przypomnień. Pojawią się tutaj automatycznie po pierwszym pomiarze ciała lub zaplanowaniu badań krwi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {habits.map(habit => (
        <div key={habit.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[#2e3229] bg-[#0d0e0c]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#f1f2ec] truncate">{habit.name}</p>
            <p className="text-[10px] text-[#8c9282] mt-0.5">
              {habit.isActive ? "Aktywne" : "Wyłączone"} · ostatnia zmiana: {habit.validFrom
                ? new Date(habit.validFrom).toLocaleDateString("pl-PL")
                : "—"}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Częstotliwość */}
            <select
              value={habit.frequency}
              onChange={e => handleFrequencyChange(habit, e.target.value)}
              disabled={saving === habit.id}
              className="bg-[#1a1c18] border border-[#2e3229] rounded-lg text-xs p-1.5 text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
            >
              {FREQUENCY_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* Toggle aktywności */}
            <button
              onClick={() => handleToggle(habit)}
              disabled={saving === habit.id}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                habit.isActive
                  ? "bg-[#bce663]/10 border-[#bce663]/30 text-[#bce663] hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400"
                  : "bg-[#2e3229]/20 border-[#2e3229] text-[#8c9282] hover:bg-[#bce663]/10 hover:border-[#bce663]/30 hover:text-[#bce663]"
              }`}
            >
              {saving === habit.id ? "..." : habit.isActive ? "Wyłącz" : "Włącz"}
            </button>
          </div>
        </div>
      ))}

      <p className="text-[10px] text-[#8c9282] pt-2">
        Zmiana częstotliwości tworzy nową wersję nawyku od dziś. Historyczne wpisy pozostają niezmienione.
      </p>
    </div>
  );
}

// ─── RunnaSection ─────────────────────────────────────────────────────────────

function RunnaSection({
  initialUrl,
  initialLastSynced,
}: {
  initialUrl: string | null;
  initialLastSynced: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [lastSynced, setLastSynced] = useState(initialLastSynced);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isValidUrl = isValidRunnaCalendarUrl(url);
  const hasUnsaved = url !== (savedUrl ?? "");

  const handleSave = async () => {
    if (!isValidUrl) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/runna", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarUrl: url }),
      });
      if (res.ok) {
        setSavedUrl(url);
        setMessage("✓ URL zapisany");
      } else {
        const data = await res.json();
        setMessage(`✗ ${data.error || "Błąd zapisu"}`);
      }
    } catch {
      setMessage("✗ Błąd połączenia");
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/runna", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ Zsynchronizowano ${data.synced} treningów${data.removed ? `, usunięto ${data.removed}` : ""}`);
        setLastSynced(new Date().toISOString());
      } else {
        setMessage(`✗ ${data.error || "Błąd synchronizacji"}`);
      }
    } catch {
      setMessage("✗ Błąd połączenia");
    }
    setSyncing(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDisconnect = async () => {
    if (!confirm("Odłączyć Runna? URL kalendarza zostanie usunięty.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/runna", { method: "DELETE" });
      if (res.ok) {
        setSavedUrl(null);
        setUrl("");
        setLastSynced(null);
        setMessage("✓ Runna odłączono");
      }
    } catch {
      setMessage("✗ Błąd");
    }
    setDeleting(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const connected = !!savedUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            <Footprints className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Runna</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {connected ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-[#8c9282]">
                    Kalendarz połączony
                    {lastSynced && ` · sync ${new Date(lastSynced).toLocaleDateString("pl-PL")}`}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-[#8c9282]" />
                  <span className="text-xs text-[#8c9282]">Brak połączenia</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="text-xs h-8 border-[#2e3229] text-[#f1f2ec] hover:bg-[#2e3229]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync..." : "Sync"}
            </Button>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="pl-11 pt-2 border-t border-[#2e3229] space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#8c9282]">
            Link do kalendarza Runna (iCal URL)
          </Label>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://cal.runna.com/...ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs flex-1"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !isValidUrl || !hasUnsaved}
              className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs h-9 px-4"
            >
              {saving ? "..." : "Zapisz"}
            </Button>
          </div>
          {url && !isValidUrl && (
            <p className="text-[10px] text-rose-400">
              {RUNNA_URL_HINT}
            </p>
          )}
        </div>

        {message && (
          <p className={`text-xs ${message.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>
            {message}
          </p>
        )}

        {connected && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[#8c9282]">
              Import zaplanowanych treningów biegowych. Auto-sync codziennie o 3:00.
            </p>
            <button
              onClick={handleDisconnect}
              disabled={deleting}
              className="text-[10px] text-[#8c9282] hover:text-rose-400 transition-colors"
            >
              {deleting ? "..." : "Odłącz"}
            </button>
          </div>
        )}

        {!connected && (
          <p className="text-[10px] text-[#8c9282]">
            Aby uzyskać link: Runna App → Profil → Connected Apps → Calendars → Other → skopiuj URL.
          </p>
        )}
      </div>
    </div>
  );
}
